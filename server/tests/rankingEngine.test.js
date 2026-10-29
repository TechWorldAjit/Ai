import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateRankScores } from '../services/rankingEngine.js';

describe('Ranking Engine Tests', () => {
  it('should calculate explainable rank scores based on verified status and quality', () => {
    const verifiedTool = {
      name: 'Cursor',
      qualityScore: 90,
      trendScore: 90,
      relevanceScore: 90,
      verification: { isOnline: true, statusCode: 200, title: 'Cursor', metaDescription: 'AI code editor' },
      status: 'active',
      savesCount: 5,
      createdAt: new Date(),
    };

    const scores = calculateRankScores(verifiedTool, 'ai-coding-assistants');

    assert.ok(scores.rankScore >= 80 && scores.rankScore <= 100);
    assert.ok(scores.qualityScore >= 85);
    assert.ok(scores.confidence >= 0.8);
    assert.strictEqual(scores.rankingBreakdown.isVerified, true);
  });

  it('should apply penalty for broken status', () => {
    const brokenTool = {
      name: 'Defunct Tool',
      qualityScore: 70,
      trendScore: 50,
      relevanceScore: 80,
      status: 'broken',
      verification: { isOnline: false },
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
    };

    const scores = calculateRankScores(brokenTool, 'general');

    assert.ok(scores.qualityScore < 50);
    assert.ok(scores.rankScore < 60);
  });
});

