/**
 * Ranking Engine for the Ultimate Global Tool Directory.
 * Combines long-term quality, time-decayed trend momentum, and category relevance.
 */

// Category-specific weight configurations
const CATEGORY_WEIGHTS = {
  // AI Tools heavily value emerging momentum alongside quality
  'ai': { quality: 0.45, trend: 0.45, relevance: 0.10 },
  // Academic & Research categories prioritize longevity, accuracy, and depth
  'research': { quality: 0.70, trend: 0.15, relevance: 0.15 },
  // Developer tools value stability, quality, and active maintenance
  'dev': { quality: 0.60, trend: 0.25, relevance: 0.15 },
  // Default balanced weighting
  'default': { quality: 0.55, trend: 0.30, relevance: 0.15 },
};

function getWeightsForCategory(categorySlug = '') {
  const slug = categorySlug.toLowerCase();
  if (slug.includes('ai-') || slug.includes('intelligent') || slug.includes('generator')) {
    return CATEGORY_WEIGHTS.ai;
  }
  if (slug.includes('research') || slug.includes('academic') || slug.includes('education') || slug.includes('science')) {
    return CATEGORY_WEIGHTS.research;
  }
  if (slug.includes('dev') || slug.includes('code') || slug.includes('database') || slug.includes('api')) {
    return CATEGORY_WEIGHTS.dev;
  }
  return CATEGORY_WEIGHTS.default;
}

/**
 * Calculates time decay multiplier for trend signals.
 * Trends decay with a 60-day half life.
 */
function calculateTrendDecay(lastUpdatedDate) {
  if (!lastUpdatedDate) return 0.5;
  const daysPassed = (Date.now() - new Date(lastUpdatedDate).getTime()) / (1000 * 60 * 60 * 24);
  const halfLifeDays = 60;
  return Math.pow(0.5, Math.max(0, daysPassed) / halfLifeDays);
}

/**
 * Calculates updated quality, trend, and overall rank score for a resource.
 * @param {object} resource 
 * @param {string} categorySlug 
 * @returns {object} { qualityScore, trendScore, rankScore, confidence, rankingBreakdown }
 */
export function calculateRankScores(resource, categorySlug = '') {
  let rawQuality = resource.qualityScore || 70;
  let rawTrend = resource.trendScore || 65;
  const rawRelevance = resource.relevanceScore || 85;

  // 1. Verification adjustments
  let verificationBonus = 0;
  if (resource.verification?.isOnline) {
    verificationBonus += 10;
    if (resource.verification.statusCode === 200) verificationBonus += 5;
    if (resource.verification.title) verificationBonus += 3;
    if (resource.verification.metaDescription) verificationBonus += 2;
  } else if (resource.status === 'broken') {
    verificationBonus -= 40;
  } else if (resource.status === 'unverified') {
    verificationBonus -= 15;
  }

  // 2. User bookmark / engagement bonus
  const savesCount = resource.savesCount || 0;
  const engagementBonus = Math.min(10, savesCount * 2);

  // Adjusted Quality Score (clamped 1-100)
  const qualityScore = Math.min(100, Math.max(1, Math.round(rawQuality * 0.8 + verificationBonus + engagementBonus)));

  // 3. Trend Score with Time Decay
  const trendDecay = calculateTrendDecay(resource.lastVerified || resource.createdAt);
  const trendScore = Math.min(100, Math.max(1, Math.round(rawTrend * trendDecay + (resource.verification?.isOnline ? 10 : 0))));

  // 4. Weights & Blended Rank
  const weights = getWeightsForCategory(categorySlug);
  const rankScore = Math.min(
    100,
    Math.max(
      1,
      Math.round(
        qualityScore * weights.quality +
        trendScore * weights.trend +
        rawRelevance * weights.relevance
      )
    )
  );

  // 5. Confidence rating (0.0 to 1.0)
  let confidence = 0.5;
  if (resource.verification?.isOnline) confidence += 0.3;
  if (resource.verification?.title) confidence += 0.1;
  if (resource.provenance && resource.provenance.length > 1) confidence += 0.1;
  confidence = Math.min(1.0, Math.max(0.1, Number(confidence.toFixed(2))));

  return {
    qualityScore,
    trendScore,
    rankScore,
    confidence,
    rankingBreakdown: {
      qualityWeight: weights.quality,
      trendWeight: weights.trend,
      relevanceWeight: weights.relevance,
      timeDecayFactor: Number(trendDecay.toFixed(2)),
      isVerified: Boolean(resource.verification?.isOnline),
    },
  };
}

