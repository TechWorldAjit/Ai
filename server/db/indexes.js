/**
 * Ensures all necessary MongoDB unique constraints, compound indexes,
 * and text indexes are created for performance and strict deduplication.
 */
export async function ensureIndexes(db) {
  try {
    const resources = db.collection('resources');
    const categories = db.collection('categories');
    const discoveryJobs = db.collection('discovery_jobs');
    const auditLogs = db.collection('audit_logs');

    // 1. Resources Indexes
    // Strict uniqueness on normalized URL to prevent duplicate records at the database level
    await resources.createIndex({ normalizedUrl: 1 }, { unique: true });
    await resources.createIndex({ canonicalUrl: 1 });
    await resources.createIndex({ domain: 1 });
    await resources.createIndex({ categorySlugs: 1 });
    await resources.createIndex({ categorySlugs: 1, rankScore: -1 });
    await resources.createIndex({ categorySlugs: 1, trendScore: -1 });
    await resources.createIndex({ categorySlugs: 1, qualityScore: -1 });
    await resources.createIndex({ status: 1 });
    await resources.createIndex({ createdAt: -1 });
    await resources.createIndex({ lastVerified: -1 });
    // Text index for full-text search
    await resources.createIndex(
      { name: 'text', description: 'text', tags: 'text' },
      { weights: { name: 10, tags: 5, description: 2 }, name: 'ResourceTextIndex' }
    );

    // 2. Categories Indexes
    await categories.createIndex({ slug: 1 }, { unique: true });
    await categories.createIndex({ parentSlug: 1 });
    await categories.createIndex({ order: 1 });

    // 3. Discovery Jobs Indexes
    await discoveryJobs.createIndex({ targetCategorySlug: 1 });
    await discoveryJobs.createIndex({ status: 1 });
    await discoveryJobs.createIndex({ createdAt: -1 });

    // 4. Audit Logs Indexes
    await auditLogs.createIndex({ timestamp: -1 });
    await auditLogs.createIndex({ resourceId: 1 });

    console.log('[Database] Indexes and unique constraints verified successfully.');
  } catch (err) {
    console.warn('[Database] Index verification notice:', err.message);
  }
}

