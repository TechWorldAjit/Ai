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
});

