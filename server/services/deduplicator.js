import { normalizeUrl } from '../utils/urlNormalizer.js';
import { calculateRankScores } from './rankingEngine.js';

/**
 * Searches the database to find if an existing resource matches the candidate.
 * Matches by:
 * 1. normalizedUrl
 * 2. canonicalUrl
 * 3. Verified finalUrl
 * 4. domain + normalized name (except for multi-tenant domains like github.com)
 * 
 * @param {object} db - MongoDB database instance
 * @param {object} candidate - { name, officialUrl, ... }
 * @param {object} verification - { finalUrl, ... }
 * @returns {Promise<object|null>} Existing document or null
 */
export async function findDuplicateResource(db, candidate, verification = {}) {
  const norm = normalizeUrl(candidate.officialUrl);
  if (!norm.isValid) return null;

  const collection = db.collection('resources');

  // 1. Direct match on normalizedUrl or canonicalUrl
  const urlQueries = [
    { normalizedUrl: norm.normalizedUrl },
    { canonicalUrl: norm.canonicalUrl },
  ];

  if (verification?.finalUrl) {
    const normFinal = normalizeUrl(verification.finalUrl);
    if (normFinal.isValid) {
      urlQueries.push({ normalizedUrl: normFinal.normalizedUrl });
      urlQueries.push({ canonicalUrl: normFinal.canonicalUrl });
    }
  }

  let match = await collection.findOne({ $or: urlQueries });
  if (match) return match;

  // 2. If NOT a multi-tenant domain, match by normalized domain and canonical name similarity
  if (!norm.isMultiTenant && norm.domain) {
    const cleanName = candidate.name.trim().toLowerCase();
    match = await collection.findOne({
      domain: norm.domain,
      name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    });
    if (match) return match;
  }

  return null;
}

/**
 * Inserts a new resource or enriches an existing resource atomically.
 * Prevents race conditions and duplicate records.
 * 
 * @param {object} db - MongoDB instance
 * @param {object} candidate - Candidate details from discovery
 * @param {string} targetCategorySlug - Category being updated
 * @param {object} verification - Output from verifyWebsite()
 * @returns {Promise<{ action: 'inserted' | 'enriched' | 'skipped', resourceId: any, error?: string }>}
 */
export async function upsertResource(db, candidate, targetCategorySlug, verification = {}) {
  const norm = normalizeUrl(candidate.officialUrl);
  if (!norm.isValid) {
    return { action: 'skipped', error: norm.error };
  }

  const collection = db.collection('resources');
  const auditCollection = db.collection('audit_logs');

  // Check for duplicate in DB
  const existing = await findDuplicateResource(db, candidate, verification);

  const now = new Date();

  if (existing) {
    // ENRICH EXISTING RECORD: Add category if not already present, update verification & provenance
    const updatedCategorySlugs = Array.from(new Set([...(existing.categorySlugs || []), targetCategorySlug]));
    const updatedTags = Array.from(new Set([...(existing.tags || []), ...(candidate.tags || [])]));

    const existingProvenance = existing.provenance || [];
    const newProvenanceEntry = {
      source: 'discovery_job',
      category: targetCategorySlug,
      timestamp: now,
      evidenceNote: candidate.trendReason || 'Re-discovered during category update',
    };

    // Calculate recalculated rank scores with fresh verification
    const scores = calculateRankScores({
      ...existing,
      qualityScore: Math.max(existing.qualityScore || 50, candidate.qualityScore || 50),
      trendScore: candidate.trendScore || existing.trendScore || 50,
      verification,
      lastVerified: now,
    }, targetCategorySlug);

    const updateFields = {
      categorySlugs: updatedCategorySlugs,
      tags: updatedTags,
      lastVerified: now,
      updatedAt: now,
      qualityScore: scores.qualityScore,
      trendScore: scores.trendScore,
      rankScore: scores.rankScore,
      confidence: scores.confidence,
    };

    if (verification?.isOnline) {
      updateFields.status = 'active';
      updateFields.verification = verification;
    }

    if (candidate.pricing && candidate.pricing !== 'unknown' && (!existing.pricing || existing.pricing === 'unknown')) {
      updateFields.pricing = candidate.pricing;
    }

    await collection.updateOne(
      { _id: existing._id },
      {
        $set: updateFields,
        $push: { provenance: { $each: [newProvenanceEntry], $slice: -20 } },
      }
    );

    // Audit log
    await auditCollection.insertOne({
      action: 'resource_enriched',
      resourceId: existing._id,
      resourceName: existing.name,
      addedCategory: targetCategorySlug,
      timestamp: now,
    });

    return { action: 'enriched', resourceId: existing._id };
  }

  // INSERT NEW RESOURCE
  // Compute initial rank scores
  const initialResource = {
    name: candidate.name.trim(),
    canonicalUrl: norm.canonicalUrl,
    normalizedUrl: norm.normalizedUrl,
    domain: norm.domain,
    rootDomain: norm.rootDomain,
    isMultiTenant: norm.isMultiTenant,
    description: candidate.description.trim(),
    categorySlugs: [targetCategorySlug],
    tags: candidate.tags || [],
    pricing: candidate.pricing || 'unknown',
    status: verification.isOnline ? 'active' : (verification.status || 'unverified'),
    qualityScore: candidate.qualityScore || 70,
    trendScore: candidate.trendScore || 70,
    relevanceScore: 85,
    savesCount: 0,
    verification: verification.isOnline ? verification : {
      isOnline: false,
      statusCode: verification.statusCode || null,
      finalUrl: norm.canonicalUrl,
      verifiedAt: now,
      failureReason: verification.failureReason || 'Pending verification',
    },
    provenance: [
      {
        source: 'discovery_job',
        category: targetCategorySlug,
        timestamp: now,
        evidenceNote: candidate.trendReason || 'Initial discovery',
      },
    ],
    createdAt: now,
    updatedAt: now,
    lastVerified: now,
  };

  const scores = calculateRankScores(initialResource, targetCategorySlug);
  initialResource.qualityScore = scores.qualityScore;
  initialResource.trendScore = scores.trendScore;
  initialResource.rankScore = scores.rankScore;
  initialResource.confidence = scores.confidence;

  try {
    const result = await collection.insertOne(initialResource);

    await auditCollection.insertOne({
      action: 'resource_created',
      resourceId: result.insertedId,
      resourceName: initialResource.name,
      category: targetCategorySlug,
      url: initialResource.canonicalUrl,
      timestamp: now,
    });

    return { action: 'inserted', resourceId: result.insertedId };
  } catch (err) {
    // Catch unique index conflict if race condition occurred
    if (err.code === 11000) {
      console.warn(`[Deduplicator] Concurrent insert collision caught for ${norm.canonicalUrl}`);
      // Fallback: Enrich the record that just slipped in
      const existingConflict = await collection.findOne({ normalizedUrl: norm.normalizedUrl });
      if (existingConflict) {
        await collection.updateOne(
          { _id: existingConflict._id },
          { $addToSet: { categorySlugs: targetCategorySlug } }
        );
        return { action: 'enriched', resourceId: existingConflict._id };
      }
    }
    throw err;
  }
}

