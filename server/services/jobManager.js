import { EventEmitter } from 'events';
import { ObjectId } from 'mongodb';
import { getDB } from '../db/connection.js';
import { searchLiveWeb, searchGitHubRepos } from './webSearchService.js';
import { discoverCandidatesForCategory } from './geminiService.js';
import { verifyWebsite } from './verifier.js';
import { upsertResource } from './deduplicator.js';
import { calculateRankScores } from './rankingEngine.js';

class JobEventEmitter extends EventEmitter {}
export const jobEvents = new JobEventEmitter();

// Active category lock map: categorySlug -> jobId
const activeCategoryLocks = new Map();

/**
 * Checks whether an update job is already in progress for a category.
 */
export function isCategoryUpdating(categorySlug) {
  return activeCategoryLocks.has(categorySlug);
}

/**
 * Starts an asynchronous category discovery and update job.
 */
export async function startCategoryDiscoveryJob({ categorySlug, targetCount = 12, triggerSource = 'manual' }) {
  const db = getDB();
  const categoriesCollection = db.collection('categories');
  const jobsCollection = db.collection('discovery_jobs');

  // Verify category exists
  const category = await categoriesCollection.findOne({ slug: categorySlug });
  if (!category) {
    throw new Error(`Category "${categorySlug}" does not exist.`);
  }

  // Prevent duplicate concurrent runs for the same category
  if (activeCategoryLocks.has(categorySlug)) {
    const existingJobId = activeCategoryLocks.get(categorySlug);
    return { isAlreadyRunning: true, jobId: existingJobId, message: 'Update already in progress for this category.' };
  }

  const initialJob = {
    type: 'category_update',
    targetCategorySlug: categorySlug,
    targetCategoryName: category.name,
    status: 'queued',
    progress: 5,
    currentStage: 'Queued',
    triggerSource,
    metrics: {
      candidatesFound: 0,
      newAdded: 0,
      reverified: 0,
      duplicatesRejected: 0,
      failedChecks: 0,
    },
    logs: [
      { timestamp: new Date(), message: `Discovery job queued for "${category.name}".` },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    error: null,
  };

  const insertResult = await jobsCollection.insertOne(initialJob);
  const jobId = insertResult.insertedId.toString();

  // Acquire category lock
  activeCategoryLocks.set(categorySlug, jobId);

  // Run asynchronously without blocking HTTP response
  runJobPipeline(jobId, categorySlug, category, targetCount).catch((err) => {
    console.error(`[JobRunner] Unhandled failure in job ${jobId}:`, err);
  });

  return { isAlreadyRunning: false, jobId, status: 'queued' };
}

/**
 * Executes the full background research, evaluation, verification, deduplication, and ranking pipeline.
 */
async function runJobPipeline(jobId, categorySlug, category, targetCount) {
  const db = getDB();
  const jobsCollection = db.collection('discovery_jobs');
  const resourcesCollection = db.collection('resources');
  const categoriesCollection = db.collection('categories');

  const updateStage = async (stage, progress, message, metricsDelta = {}) => {
    const logEntry = { timestamp: new Date(), stage, message };
    const updateDoc = {
      $set: {
        currentStage: stage,
        status: stage.toLowerCase().replace(/\s+/g, '_'),
        progress,
        updatedAt: new Date(),
      },
      $push: { logs: logEntry },
    };

    if (Object.keys(metricsDelta).length > 0) {
      updateDoc.$inc = {};
      for (const [k, v] of Object.entries(metricsDelta)) {
        updateDoc.$inc[`metrics.${k}`] = v;
      }
    }

    await jobsCollection.updateOne({ _id: new ObjectId(jobId) }, updateDoc);
    jobEvents.emit(`job:${jobId}`, { jobId, stage, progress, message, timestamp: logEntry.timestamp });
  };

  try {
    // Stage 1: Searching live web and repositories
    await updateStage('Searching', 15, `Searching live web sources and technical catalogs for "${category.name}"...`);

    const isDevCategory = categorySlug.includes('dev') || categorySlug.includes('code') || categorySlug.includes('api');
    const [webResults, githubResults] = await Promise.all([
      searchLiveWeb(category.name, 10),
      isDevCategory ? searchGitHubRepos(category.name, 5) : Promise.resolve([]),
    ]);

    const combinedEvidence = [...webResults, ...githubResults];
    await updateStage('Searching', 30, `Found ${combinedEvidence.length} live search references and citations.`);

    // Fetch existing resource domains in this category to avoid repeating known tools
    const existingResources = await resourcesCollection.find({ categorySlugs: categorySlug }, { projection: { domain: 1 } }).toArray();
    const existingDomains = Array.from(new Set(existingResources.map((r) => r.domain).filter(Boolean)));

    // Stage 2: Evaluating with Gemini
    await updateStage('Evaluating', 45, `Synthesizing evidence and identifying best tools with Gemini API...`);

    let candidates = [];
    try {
      candidates = await discoverCandidatesForCategory({
        categoryName: category.name,
        categoryDescription: category.description,
        webEvidence: combinedEvidence,
        existingDomains,
        targetCount,
      });
    } catch (geminiErr) {
      console.warn(`[JobRunner] Gemini candidate discovery warning: ${geminiErr.message}`);
      // Fallback: extract candidates directly from web search results if Gemini had a temporary issue
      candidates = combinedEvidence.map((e) => ({
        name: e.title.slice(0, 50),
        officialUrl: e.url,
        description: (e.snippet || `Resource for ${category.name}`).slice(0, 150),
        tags: [categorySlug.split('-')[0] || 'tool'],
        pricing: 'unknown',
        qualityScore: 70,
        trendScore: 65,
        trendReason: 'Discovered from live search index',
      }));
    }

    await updateStage('Evaluating', 55, `Discovered ${candidates.length} candidate resources.`, {
      candidatesFound: candidates.length,
    });

    // Stage 3: Verifying links & SSL with SSRF protection
    await updateStage('Verifying Links', 65, `Verifying destination links, HTTP status, and metadata...`);

    const verificationResults = [];
    let failedChecksCount = 0;

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      try {
        const result = await verifyWebsite(candidate.officialUrl, 5000);
        verificationResults.push({ candidate, verification: result });
        if (!result.isOnline && result.status === 'broken') {
          failedChecksCount++;
        }
      } catch {
        failedChecksCount++;
        verificationResults.push({
          candidate,
          verification: { isOnline: false, status: 'unverified', failureReason: 'Connection failed' },
        });
      }
    }

    // Stage 4: Removing duplicate candidates & saving records
    await updateStage('Removing Duplicate Candidates', 80, `Applying global deduplication against full database...`);

    let newAddedCount = 0;
    let reverifiedCount = 0;
    let duplicatesRejectedCount = 0;

    for (const item of verificationResults) {
      try {
        const { action } = await upsertResource(db, item.candidate, categorySlug, item.verification);
        if (action === 'inserted') {
          newAddedCount++;
        } else if (action === 'enriched') {
          reverifiedCount++;
        } else {
          duplicatesRejectedCount++;
        }
      } catch (upsertErr) {
        console.error(`[JobRunner] Upsert error for candidate "${item.candidate.name}":`, upsertErr.message);
        failedChecksCount++;
      }
    }

    // Stage 5: Recalculating category rankings
    await updateStage('Recalculating Rankings', 92, `Updating multi-signal rankings and category counts...`);

    // Recalculate rank scores for all tools in this category
    const categoryResources = await resourcesCollection.find({ categorySlugs: categorySlug }).toArray();
    for (const res of categoryResources) {
      const newScores = calculateRankScores(res, categorySlug);
      await resourcesCollection.updateOne(
        { _id: res._id },
        {
          $set: {
            qualityScore: newScores.qualityScore,
            trendScore: newScores.trendScore,
            rankScore: newScores.rankScore,
            confidence: newScores.confidence,
          },
        }
      );
    }

    // Update category resource count & lastDiscoveryAt
    const totalCount = await resourcesCollection.countDocuments({ categorySlugs: categorySlug });
    await categoriesCollection.updateOne(
      { slug: categorySlug },
      {
        $set: {
          resourceCount: totalCount,
          lastDiscoveryAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    // Final Stage: Completed
    const finalStatus = failedChecksCount > 0 && newAddedCount === 0 ? 'completed_with_warnings' : 'completed';
    const finalMessage = `Completed! ${newAddedCount} new tools added, ${reverifiedCount} reverified, ${duplicatesRejectedCount} duplicates handled, ${failedChecksCount} failed checks. Total tools in category: ${totalCount}.`;

    await jobsCollection.updateOne(
      { _id: new ObjectId(jobId) },
      {
        $set: {
          currentStage: 'Completed',
          status: finalStatus,
          progress: 100,
          completedAt: new Date(),
          updatedAt: new Date(),
          'metrics.newAdded': newAddedCount,
          'metrics.reverified': reverifiedCount,
          'metrics.duplicatesRejected': duplicatesRejectedCount,
          'metrics.failedChecks': failedChecksCount,
        },
        $push: {
          logs: { timestamp: new Date(), stage: 'Completed', message: finalMessage },
        },
      }
    );

    jobEvents.emit(`job:${jobId}`, {
      jobId,
      stage: 'Completed',
      status: finalStatus,
      progress: 100,
      message: finalMessage,
      metrics: {
        newAdded: newAddedCount,
        reverified: reverifiedCount,
        duplicatesRejected: duplicatesRejectedCount,
        failedChecks: failedChecksCount,
      },
    });

  } catch (fatalErr) {
    console.error(`[JobRunner] Fatal job error for ${jobId}:`, fatalErr);
    await jobsCollection.updateOne(
      { _id: new ObjectId(jobId) },
      {
        $set: {
          currentStage: 'Failed',
          status: 'failed',
          progress: 100,
          error: fatalErr.message,
          completedAt: new Date(),
          updatedAt: new Date(),
        },
        $push: {
          logs: { timestamp: new Date(), stage: 'Failed', message: `Job failed: ${fatalErr.message}` },
        },
      }
    );

    jobEvents.emit(`job:${jobId}`, {
      jobId,
      stage: 'Failed',
      status: 'failed',
      progress: 100,
      message: fatalErr.message,
    });
  } finally {
    // Release category lock
    activeCategoryLocks.delete(categorySlug);
  }
}

/**
 * Starts a global discovery job across the entire ecosystem.
 * Discovers breakout tools and suggests/populates emerging categories.
 */
export async function startGlobalDiscoveryJob() {
  const db = getDB();
  const jobsCollection = db.collection('discovery_jobs');
  const categoriesCollection = db.collection('categories');

  if (activeCategoryLocks.has('__global__')) {
    return { isAlreadyRunning: true, jobId: activeCategoryLocks.get('__global__'), message: 'Global discovery is already in progress.' };
  }

  const initialJob = {
    type: 'global_discovery',
    targetCategorySlug: 'global',
    targetCategoryName: 'Global Ecosystem',
    status: 'queued',
    progress: 5,
    currentStage: 'Queued',
    triggerSource: 'global_button',
    metrics: {
      candidatesFound: 0,
      newAdded: 0,
      reverified: 0,
      duplicatesRejected: 0,
      failedChecks: 0,
      newCategoriesCreated: 0,
    },
    logs: [
      { timestamp: new Date(), message: 'Global trend and discovery job initiated.' },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    error: null,
  };

  const insertResult = await jobsCollection.insertOne(initialJob);
  const jobId = insertResult.insertedId.toString();
  activeCategoryLocks.set('__global__', jobId);

  // Run async
  (async () => {
    try {
      const allCategories = await categoriesCollection.find({}, { projection: { name: 1, slug: 1 } }).toArray();
      const catNames = allCategories.map((c) => c.name);

      await jobsCollection.updateOne(
        { _id: new ObjectId(jobId) },
        {
          $set: { currentStage: 'Analyzing Trends', progress: 25, updatedAt: new Date() },
          $push: { logs: { timestamp: new Date(), message: 'Consulting Gemini for emerging web applications and trend clusters...' } },
        }
      );

      // Import dynamic discovery from geminiService
      const { discoverEmergingGlobalTrends } = await import('./geminiService.js');
      const trendResult = await discoverEmergingGlobalTrends(catNames);
      const trends = trendResult.trends || [];

      let totalNewTools = 0;
      let totalCategoriesCreated = 0;

      for (let i = 0; i < trends.length; i++) {
        const trend = trends[i];
        const recCat = trend.recommendedCategory;

        // Check if recommended category exists
        let cat = await categoriesCollection.findOne({ slug: recCat.slug });
        if (!cat) {
          // Create new category
          const newCatDoc = {
            name: recCat.name,
            slug: recCat.slug,
            parentSlug: recCat.parentSlug || 'ai-tools',
            description: recCat.description || trend.description,
            synonyms: [recCat.name.toLowerCase()],
            icon: 'Sparkles',
            order: 99,
            resourceCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastDiscoveryAt: new Date(),
          };
          await categoriesCollection.insertOne(newCatDoc);
          cat = newCatDoc;
          totalCategoriesCreated++;
        }

        // Add sample tools
        const sampleTools = trend.sampleTools || [];
        for (const tool of sampleTools) {
          const verification = await verifyWebsite(tool.officialUrl, 5000);
          const upsertResult = await upsertResource(db, tool, cat.slug, verification);
          if (upsertResult.action === 'inserted') totalNewTools++;
        }
      }

      await jobsCollection.updateOne(
        { _id: new ObjectId(jobId) },
        {
          $set: {
            currentStage: 'Completed',
            status: 'completed',
            progress: 100,
            completedAt: new Date(),
            updatedAt: new Date(),
            'metrics.newAdded': totalNewTools,
            'metrics.newCategoriesCreated': totalCategoriesCreated,
          },
          $push: {
            logs: {
              timestamp: new Date(),
              message: `Global discovery finished: ${totalNewTools} new tools added across ${totalCategoriesCreated} new/updated categories.`,
            },
          },
        }
      );

      jobEvents.emit(`job:${jobId}`, {
        jobId,
        stage: 'Completed',
        status: 'completed',
        progress: 100,
        message: `Global discovery complete! Added ${totalNewTools} new tools and created ${totalCategoriesCreated} categories.`,
      });
    } catch (err) {
      console.error('[GlobalDiscovery] Error:', err);
      await jobsCollection.updateOne(
        { _id: new ObjectId(jobId) },
        {
          $set: { currentStage: 'Failed', status: 'failed', error: err.message, completedAt: new Date() },
          $push: { logs: { timestamp: new Date(), message: `Failed: ${err.message}` } },
        }
      );
    } finally {
      activeCategoryLocks.delete('__global__');
    }
  })();

  return { isAlreadyRunning: false, jobId, status: 'queued' };
}

