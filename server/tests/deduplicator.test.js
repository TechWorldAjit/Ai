import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { connectDB, closeDB } from '../db/connection.js';
import { upsertResource, findDuplicateResource } from '../services/deduplicator.js';

describe('Global Deduplication & Database Persistence', () => {
  let db;

  before(async () => {
    const conn = await connectDB();
    db = conn.db;
  });

  after(async () => {
    // Clean up test records
    await db.collection('resources').deleteMany({ canonicalUrl: 'https://test-dedupe-tool.dev' });
    await db.collection('audit_logs').deleteMany({ resourceName: 'Test Dedupe Tool' });
    await closeDB();
  });

  it('should insert candidate on first discovery', async () => {
    const candidate = {
      name: 'Test Dedupe Tool',
      officialUrl: 'https://test-dedupe-tool.dev?utm_source=twitter',
      description: 'Test tool for verification of deduplication system.',
      tags: ['test', 'utilities'],
      pricing: 'free',
      qualityScore: 80,
      trendScore: 80,
    };

    const verification = {
      isOnline: true,
      statusCode: 200,
      finalUrl: 'https://test-dedupe-tool.dev',
      title: 'Test Dedupe Tool Official',
    };

    const res1 = await upsertResource(db, candidate, 'online-utilities', verification);
    assert.strictEqual(res1.action, 'inserted');
    assert.ok(res1.resourceId);

    // Verify record in DB
    const doc = await db.collection('resources').findOne({ _id: res1.resourceId });
    assert.strictEqual(doc.canonicalUrl, 'https://test-dedupe-tool.dev');
    assert.deepStrictEqual(doc.categorySlugs, ['online-utilities']);
  });

  it('should enrich rather than duplicate when rediscovered with different URL params or category', async () => {
    const reDiscovered = {
      name: 'Test Dedupe Tool',
      // Same tool, different tracking param and different category
      officialUrl: 'https://test-dedupe-tool.dev?ref=newsletter',
      description: 'Updated description during category update',
      tags: ['test', 'developer-tools'],
    };

    const verification = {
      isOnline: true,
      statusCode: 200,
      finalUrl: 'https://test-dedupe-tool.dev',
    };

    const res2 = await upsertResource(db, reDiscovered, 'development-cs', verification);
    assert.strictEqual(res2.action, 'enriched');

    // Confirm that ONLY ONE document exists for this tool
    const count = await db.collection('resources').countDocuments({ canonicalUrl: 'https://test-dedupe-tool.dev' });
    assert.strictEqual(count, 1, 'Duplicate resource document was prevented');

    // Confirm that the tool is now mapped to BOTH categories!
    const doc = await db.collection('resources').findOne({ canonicalUrl: 'https://test-dedupe-tool.dev' });
    assert.ok(doc.categorySlugs.includes('online-utilities'));
    assert.ok(doc.categorySlugs.includes('development-cs'));
  });
});
