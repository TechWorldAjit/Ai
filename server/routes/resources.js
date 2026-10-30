import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../db/connection.js';
import { verifyWebsite } from '../services/verifier.js';
import { calculateRankScores } from '../services/rankingEngine.js';

const router = express.Router();

// In-memory cache for category hierarchy slugs (TTL 30s for fast queries)
let categorySlugsMap = null;
let categorySlugsMapTimestamp = 0;

async function resolveCategorySlugs(db, categorySlug) {
  const now = Date.now();
  if (!categorySlugsMap || now - categorySlugsMapTimestamp > 30000) {
    const allCats = await db.collection('categories').find({}, { projection: { slug: 1, parentSlug: 1 } }).toArray();
    const map = new Map();
    allCats.forEach((c) => {
      if (c.parentSlug) {
        if (!map.has(c.parentSlug)) map.set(c.parentSlug, []);
        map.get(c.parentSlug).push(c.slug);
      }
    });
    categorySlugsMap = map;
    categorySlugsMapTimestamp = now;
  }
  const children = categorySlugsMap.get(categorySlug) || [];
  return [categorySlug, ...children];
}

/**
 * GET /api/resources
 * Paginated, filtered, and sorted resource query engine.
 */
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const collection = db.collection('resources');

    const {
      category,
      search,
      tag,
      pricing,
      status,
      sort = 'rank',
      page = 1,
      limit = 25,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    // Category filter: handles category or subcategories with cached hierarchy
    if (category && category !== 'all') {
      const allSlugs = await resolveCategorySlugs(db, category);
      query.categorySlugs = { $in: allSlugs };
    }

    // Status filter (default: active, but allow viewing unverified or inactive)
    if (status && status !== 'all') {
      query.status = status;
    } else if (!status) {
      // By default show active and unverified; exclude broken from primary view unless requested
      query.status = { $ne: 'broken' };
    }

    // Pricing filter
    if (pricing && pricing !== 'all') {
      query.pricing = pricing;
    }

    // Tag filter
    if (tag) {
      query.tags = tag.toLowerCase();
    }

    // Search query (text search or regex fallback)
    if (search && search.trim()) {
      const cleanSearch = search.trim();
      query.$or = [
        { name: { $regex: cleanSearch, $options: 'i' } },
        { description: { $regex: cleanSearch, $options: 'i' } },
        { domain: { $regex: cleanSearch, $options: 'i' } },
        { tags: { $regex: cleanSearch, $options: 'i' } },
      ];
    }

    // Sorting
    let sortObj = { rankScore: -1, qualityScore: -1 };
    switch (sort) {
      case 'trend':
        sortObj = { trendScore: -1, rankScore: -1 };
        break;
      case 'quality':
        sortObj = { qualityScore: -1, rankScore: -1 };
        break;
      case 'newest':
        sortObj = { createdAt: -1 };
        break;
      case 'name':
        sortObj = { name: 1 };
        break;
      case 'verified':
        sortObj = { lastVerified: -1 };
        break;
      case 'rank':
      case 'relevance':
      default:
        sortObj = { rankScore: -1, trendScore: -1 };
        break;
    }

    const [resources, totalCount] = await Promise.all([
      collection.find(query).sort(sortObj).skip(skip).limit(limitNum).toArray(),
      collection.countDocuments(query),
    ]);

    // Attach dynamic rank number based on pagination
    const rankedResources = resources.map((item, index) => ({
      ...item,
      rank: skip + index + 1,
    }));

    res.json({
      success: true,
      resources: rankedResources,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
        hasMore: skip + resources.length < totalCount,
      },
    });
  } catch (err) {
    console.error('[ResourcesRoute] GET error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/resources/:id
 * Fetches a single resource with full verification history and provenance.
 */
router.get('/:id', async (req, res) => {
  try {
    const db = getDB();
    const id = req.params.id;

    let resource = null;
    if (ObjectId.isValid(id)) {
      resource = await db.collection('resources').findOne({ _id: new ObjectId(id) });
    }

    if (!resource) {
      return res.status(404).json({ success: false, error: 'Resource not found' });
    }

    // Resolve category names
    const categories = await db
      .collection('categories')
      .find({ slug: { $in: resource.categorySlugs || [] } })
      .project({ name: 1, slug: 1, parentSlug: 1 })
      .toArray();

    res.json({
      success: true,
      resource,
      categories,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/resources/:id/bookmark
 * Toggles or increments save/bookmark counter.
 */
router.post('/:id/bookmark', async (req, res) => {
  try {
    const db = getDB();
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid ID' });
    }

    const collection = db.collection('resources');
    const resource = await collection.findOne({ _id: new ObjectId(id) });
    if (!resource) {
      return res.status(404).json({ success: false, error: 'Resource not found' });
    }

    const newSaves = (resource.savesCount || 0) + 1;
    const scores = calculateRankScores({ ...resource, savesCount: newSaves }, resource.categorySlugs?.[0]);

    await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $inc: { savesCount: 1 },
        $set: {
          qualityScore: scores.qualityScore,
          rankScore: scores.rankScore,
          updatedAt: new Date(),
        },
      }
    );

    res.json({ success: true, savesCount: newSaves, rankScore: scores.rankScore });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/resources/:id/verify
 * Triggers an immediate re-verification of the resource link and metadata.
 */
router.post('/:id/verify', async (req, res) => {
  try {
    const db = getDB();
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid ID' });
    }

    const collection = db.collection('resources');
    const resource = await collection.findOne({ _id: new ObjectId(id) });
    if (!resource) {
      return res.status(404).json({ success: false, error: 'Resource not found' });
    }

    const verification = await verifyWebsite(resource.canonicalUrl, 6000);
    const scores = calculateRankScores({ ...resource, verification }, resource.categorySlugs?.[0]);

    await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          verification,
          status: verification.isOnline ? 'active' : (verification.status || 'unverified'),
          lastVerified: new Date(),
          qualityScore: scores.qualityScore,
          rankScore: scores.rankScore,
          updatedAt: new Date(),
        },
      }
    );

    res.json({ success: true, verification, status: verification.status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

