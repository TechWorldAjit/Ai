import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { connectDB, closeDB } from '../db/connection.js';

describe('Category Deletion & Zero-Deletion Preservation', () => {
  let db;

  before(async () => {
    const conn = await connectDB();
    db = conn.db;

    // Create a temporary test category and associated resource
    await db.collection('categories').insertOne({
      name: 'Temp Deletable Category',
      slug: 'temp-deletable-category',
      parentSlug: null,
      description: 'Temporary category for delete test',
      resourceCount: 1,
      createdAt: new Date(),
    });

    await db.collection('resources').insertOne({
      name: 'Preserved Tool Test',
      canonicalUrl: 'https://preserved-tool-test.org',
      normalizedUrl: 'https://preserved-tool-test.org',
      domain: 'preserved-tool-test.org',
      description: 'Must survive category deletion.',
      categorySlugs: ['temp-deletable-category', 'development-cs'],
      status: 'active',
      qualityScore: 90,
      trendScore: 90,
      rankScore: 90,
      createdAt: new Date(),
    });
  });

  after(async () => {
    await db.collection('categories').deleteMany({ slug: 'temp-deletable-category' });
    await db.collection('resources').deleteMany({ canonicalUrl: 'https://preserved-tool-test.org' });
    await db.collection('audit_logs').deleteMany({ categorySlug: 'temp-deletable-category' });
    await closeDB();
  });

  it('should remove category from categories collection but PRESERVE tool in resources collection', async () => {
    const categoriesCollection = db.collection('categories');
    const resourcesCollection = db.collection('resources');
    const auditCollection = db.collection('audit_logs');

    const slug = 'temp-deletable-category';

    // Simulate delete logic
    const updateResult = await resourcesCollection.updateMany(
      { categorySlugs: slug },
      { $pull: { categorySlugs: slug } }
    );
    await categoriesCollection.deleteOne({ slug });
    await auditCollection.insertOne({
      action: 'category_deleted',
      categorySlug: slug,
      categoryName: 'Temp Deletable Category',
      timestamp: new Date(),
    });

    // 1. Verify category document is removed
    const catCheck = await categoriesCollection.findOne({ slug });
    assert.strictEqual(catCheck, null, 'Category should be deleted from categories collection');

    // 2. CRITICAL: Verify the tool document was NOT deleted!
    const toolCheck = await resourcesCollection.findOne({ canonicalUrl: 'https://preserved-tool-test.org' });
    assert.ok(toolCheck, 'Tool document must remain permanently preserved in MongoDB');
    assert.strictEqual(toolCheck.name, 'Preserved Tool Test');
    assert.strictEqual(toolCheck.categorySlugs.includes('temp-deletable-category'), false, 'Deleted slug should be pulled');
    assert.strictEqual(toolCheck.categorySlugs.includes('development-cs'), true, 'Other categories should remain intact');

    // 3. Verify audit log entry
    const auditCheck = await auditCollection.findOne({ categorySlug: slug });
    assert.ok(auditCheck, 'Audit log entry should exist');
  });

  it('should identify and prune categories with fewer than 5 entries while preserving resources', async () => {
    const categoriesCollection = db.collection('categories');
    const resourcesCollection = db.collection('resources');

    const suffix = Date.now();
    const lowSlug = `temp-low-${suffix}`;
    const highSlug = `temp-high-${suffix}`;

    // Clean up any stale test records first
    await categoriesCollection.deleteMany({ slug: { $regex: '^temp-' } });
    await resourcesCollection.deleteMany({ canonicalUrl: { $regex: '^https://tool-(low|high)-' } });

    await categoriesCollection.insertMany([
      { name: 'Low Entry Cat', slug: lowSlug, parentSlug: 'ai-tools', createdAt: new Date() },
      { name: 'High Entry Cat', slug: highSlug, parentSlug: 'ai-tools', createdAt: new Date() },
    ]);

    // Insert 2 tools for lowSlug
    await resourcesCollection.insertMany([
      { name: 'Tool Low 1', canonicalUrl: `https://tool-low-1-${suffix}.org`, normalizedUrl: `https://tool-low-1-${suffix}.org`, categorySlugs: [lowSlug], status: 'active', createdAt: new Date() },
      { name: 'Tool Low 2', canonicalUrl: `https://tool-low-2-${suffix}.org`, normalizedUrl: `https://tool-low-2-${suffix}.org`, categorySlugs: [lowSlug], status: 'active', createdAt: new Date() },
    ]);

    // Insert 5 tools for highSlug
    const highTools = Array.from({ length: 5 }, (_, i) => ({
      name: `Tool High ${i + 1}`,
      canonicalUrl: `https://tool-high-${i + 1}-${suffix}.org`,
      normalizedUrl: `https://tool-high-${i + 1}-${suffix}.org`,
      categorySlugs: [highSlug],
      status: 'active',
      createdAt: new Date(),
    }));
    await resourcesCollection.insertMany(highTools);

    try {
      // Find count
      const countAgg = await resourcesCollection.aggregate([
        { $unwind: '$categorySlugs' },
        { $group: { _id: '$categorySlugs', count: { $sum: 1 } } },
      ]).toArray();
      const countMap = new Map();
      countAgg.forEach(i => countMap.set(i._id, i.count));

      assert.strictEqual(countMap.get(lowSlug), 2);
      assert.strictEqual(countMap.get(highSlug), 5);

      // Perform prune for < 5
      const toDelete = [lowSlug];
      await resourcesCollection.updateMany(
        { categorySlugs: { $in: toDelete } },
        { $pull: { categorySlugs: { $in: toDelete } } }
      );
      await categoriesCollection.deleteMany({ slug: { $in: toDelete } });

      // lowSlug should be gone, highSlug should remain
      const lowCheck = await categoriesCollection.findOne({ slug: lowSlug });
      const highCheck = await categoriesCollection.findOne({ slug: highSlug });
      assert.strictEqual(lowCheck, null, 'Low entry category should be removed');
      assert.ok(highCheck, 'Category with 5+ entries should be preserved');

      // Tools from lowSlug should still exist in resources collection
      const toolCheck = await resourcesCollection.findOne({ canonicalUrl: `https://tool-low-1-${suffix}.org` });
      assert.ok(toolCheck, 'Tools from pruned category must remain permanently preserved in DB');
    } finally {
      await categoriesCollection.deleteMany({ slug: { $in: [lowSlug, highSlug] } });
      await resourcesCollection.deleteMany({ categorySlugs: { $in: [lowSlug, highSlug] } });
      await resourcesCollection.deleteMany({ canonicalUrl: { $regex: '^https://tool-(low|high)-' } });
    }
  });
});

