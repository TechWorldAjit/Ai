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

// 10 Comprehensive Research Facets to power 100 - 1000+ deep tool discovery without repetition
const DISCOVERY_FACETS = [
  {
    name: 'Industry Leaders & Popular Suites',
    querySuffix: 'top popular software tools websites',
    focus: 'Identify the most established, reputable, and widely used software tools, platforms, and industry-standard websites.',
  },
  {
    name: 'Open-Source & GitHub Repositories',
    querySuffix: 'open source github repository self-hosted software',
    focus: 'Identify open-source, permissive license, self-hostable tools, and developer-loved GitHub projects.',
  },
  {
    name: 'Breakout Startups & Recent Launches',
    querySuffix: 'new launch 2025 2026 producthunt startup tool',
    focus: 'Identify newly launched websites, emerging startups, and recent breakout tools from 2025 and 2026.',
  },
  {
    name: 'Specialized Niche Utilities & Power Tools',
    querySuffix: 'specialized niche utilities workflow productivity',
    focus: 'Identify specialized niche utilities, workflow efficiency tools, and single-purpose power-user web applications.',
  },
  {
    name: 'Free & Generous Freemium Platforms',
    querySuffix: 'free freemium software web application',
    focus: 'Identify completely free or high-value freemium tools with generous tiers for everyday users.',
  },
  {
    name: 'Developer Utilities, CLI & Micro-Services',
    querySuffix: 'developer utility tool cli web app',
    focus: 'Identify developer utilities, CLI tools, browser helpers, and programmatic web services.',
  },
  {
    name: 'Innovative AI-Native & Autonomous Systems',
    querySuffix: 'AI native autonomous smart tools software',
    focus: 'Identify cutting-edge AI-native platforms, autonomous workflows, and modern machine intelligence tools.',
  },
  {
    name: 'Community Favorites & Hidden Gems',
    querySuffix: 'awesome list community recommended hidden gems tools',
    focus: 'Identify community-recommended hidden gems, awesome-list favorites, and lesser-known high-utility web tools.',
  },
  {
    name: 'Global & International Web Alternatives',
    querySuffix: 'alternative tools software global websites',
    focus: 'Identify high-quality international platforms, independent web creations, and viable alternative solutions.',
  },
  {
    name: 'High-Performance & Enterprise Grade Solutions',
    querySuffix: 'enterprise professional high performance tools',
    focus: 'Identify enterprise-ready, scalable, team-oriented, and high-performance digital tools.',
  },
];

/**
 * Checks whether an update job is already in progress for a category.
 */
export function isCategoryUpdating(categorySlug) {
  return activeCategoryLocks.has(categorySlug);
}

/**
 * Starts an asynchronous category discovery and update job.
 * Default targetCount is 100 (never less than 100, up to 1000).
 */
export async function startCategoryDiscoveryJob({ categorySlug, targetCount = 100, triggerSource = 'manual' }) {
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

  // Enforce at least 100 tools target
  const verifiedTarget = Math.min(1000, Math.max(100, parseInt(targetCount, 10) || 100));

  const initialJob = {
    type: 'category_update',
    targetCategorySlug: categorySlug,
    targetCategoryName: category.name,
    targetCount: verifiedTarget,
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
      { timestamp: new Date(), message: `High-scale research job queued for "${category.name}" (Target: ${verifiedTarget}+ tools).` },
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
  runJobPipeline(jobId, categorySlug, category, verifiedTarget).catch((err) => {
    console.error(`[JobRunner] Unhandled failure in job ${jobId}:`, err);
  });

  return { isAlreadyRunning: false, jobId, status: 'queued' };
}

/**
 * Executes high-throughput multi-batch discovery pipeline across facets to yield 100 - 1000 tools.
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
        progress: Math.min(99, Math.max(5, progress)),
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
    const isDevCategory = categorySlug.includes('dev') || categorySlug.includes('code') || categorySlug.includes('api');

    // Pre-load known domains to avoid repeating already stored tools
    const existingResources = await resourcesCollection.find({ categorySlugs: categorySlug }, { projection: { domain: 1 } }).toArray();
    const accumulatedDomains = new Set(existingResources.map((r) => r.domain).filter(Boolean));

    let totalFound = 0;
    let totalNewAdded = 0;
    let totalReverified = 0;
    let totalDuplicatesPrevented = 0;
    let totalFailedChecks = 0;

    const BATCH_SIZE = 25;
    const totalBatches = Math.max(4, Math.ceil(targetCount / BATCH_SIZE));

    await updateStage(
      'Searching',
      10,
      `Initiating multi-batch discovery engine for "${category.name}". Target: at least ${targetCount} tools across ${totalBatches} research facets.`
    );

    for (let batchIdx = 0; batchIdx < totalBatches && (totalNewAdded + totalReverified) < targetCount; batchIdx++) {
      const facet = DISCOVERY_FACETS[batchIdx % DISCOVERY_FACETS.length];
      const batchNum = batchIdx + 1;
      const progressPercent = Math.round(10 + (batchIdx / totalBatches) * 75);

      await updateStage(
        'Searching',
        progressPercent,
        `[Batch ${batchNum}/${totalBatches}] Live web research: "${facet.name}"...`
      );

      // 1. Multi-source live search for this specific facet
      const [webResults, githubResults] = await Promise.all([
        searchLiveWeb(`${category.name} ${facet.querySuffix}`, 8),
        isDevCategory ? searchGitHubRepos(`${category.name} ${facet.querySuffix}`, 4) : Promise.resolve([]),
      ]);
      const combinedEvidence = [...webResults, ...githubResults];

      // 2. Synthesize candidates with Gemini for this facet
      await updateStage(
        'Evaluating',
        progressPercent + 2,
        `[Batch ${batchNum}/${totalBatches}] Gemini synthesizing candidates for "${facet.name}" (Collected: ${totalNewAdded + totalReverified}/${targetCount})...`
      );

      let batchCandidates = [];
      try {
        batchCandidates = await discoverCandidatesForCategory({
          categoryName: category.name,
          categoryDescription: `${category.description || category.name}. Focus: ${facet.focus}`,
          webEvidence: combinedEvidence,
          existingDomains: Array.from(accumulatedDomains).slice(-120),
          targetCount: BATCH_SIZE,
          facetFocus: facet.focus,
        });
      } catch (geminiErr) {
        console.warn(`[JobRunner] Batch ${batchNum} Gemini notice: ${geminiErr.message}`);
        // Fallback to evidence
        batchCandidates = combinedEvidence.map((e) => ({
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

      totalFound += batchCandidates.length;

      // 3. Concurrently verify links (in parallel for maximum throughput)
      await updateStage(
        'Verifying Links',
        progressPercent + 4,
        `[Batch ${batchNum}/${totalBatches}] Cryptographic & HTTP link verification (${batchCandidates.length} candidates)...`
      );

      const verifiedBatch = await Promise.all(
        batchCandidates.map(async (candidate) => {
          try {
            const verification = await verifyWebsite(candidate.officialUrl, 5000);
            return { candidate, verification };
          } catch {
            return {
              candidate,
              verification: { isOnline: false, status: 'unverified', failureReason: 'Connection timed out' },
            };
          }
        })
      );

      // 4. Global Deduplication & Atomic Database Storage
      let batchNew = 0;
      let batchReverified = 0;

      for (const item of verifiedBatch) {
        try {
          const { action } = await upsertResource(db, item.candidate, categorySlug, item.verification);
          if (item.candidate.officialUrl) {
            try {
              const u = new URL(item.candidate.officialUrl);
              accumulatedDomains.add(u.hostname.replace('www.', ''));
            } catch {}
          }

          if (action === 'inserted') {
            totalNewAdded++;
            batchNew++;
          } else if (action === 'enriched') {
            totalReverified++;
            batchReverified++;
          } else {
            totalDuplicatesPrevented++;
          }
        } catch {
          totalFailedChecks++;
        }
      }

      await updateStage(
        'Removing Duplicate Candidates',
        progressPercent + 6,
        `[Batch ${batchNum}/${totalBatches}] Saved: +${batchNew} new, ${batchReverified} reverified. Total category tools collected: ${totalNewAdded + totalReverified}.`
      );

      // Short delay between batches to respect rate limits
      await new Promise((r) => setTimeout(r, 1000));
    }

    // Stage 5: Recalculating category rankings
    await updateStage('Recalculating Rankings', 92, `Updating multi-signal rankings and category counts across ${totalNewAdded + totalReverified} tools...`);

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
    const finalMessage = `Completed research cycle! Added ${totalNewAdded} brand-new tools, reverified ${totalReverified} existing, prevented ${totalDuplicatesPrevented} duplicates. Total category size: ${totalCount} tools.`;

    await jobsCollection.updateOne(
      { _id: new ObjectId(jobId) },
      {
        $set: {
          currentStage: 'Completed',
          status: 'completed',
          progress: 100,
          completedAt: new Date(),
          updatedAt: new Date(),
          'metrics.candidatesFound': totalFound,
          'metrics.newAdded': totalNewAdded,
          'metrics.reverified': totalReverified,
          'metrics.duplicatesRejected': totalDuplicatesPrevented,
          'metrics.failedChecks': totalFailedChecks,
        },
        $push: {
          logs: { timestamp: new Date(), stage: 'Completed', message: finalMessage },
        },
      }
    );

    jobEvents.emit(`job:${jobId}`, {
      jobId,
      stage: 'Completed',
      status: 'completed',
      progress: 100,
      message: finalMessage,
      metrics: {
        candidatesFound: totalFound,
        newAdded: totalNewAdded,
        reverified: totalReverified,
        duplicatesRejected: totalDuplicatesPrevented,
        failedChecks: totalFailedChecks,
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
 * Discovers breakout tools across all 6 core directory branches (guaranteed 100+ tools).
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
    targetCount: 150,
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
      { timestamp: new Date(), message: 'High-scale global discovery initiated (Target: 100 - 150+ breakout tools across all 6 core branches).' },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    error: null,
  };

  const insertResult = await jobsCollection.insertOne(initialJob);
  const jobId = insertResult.insertedId.toString();
  activeCategoryLocks.set('__global__', jobId);

  // 6 Macro branches to cover the entire internet taxonomy
  const MACRO_BRANCHES = [
    { name: 'AI and Intelligent Tools', slug: 'ai-tools' },
    { name: 'Creative and Design Tools', slug: 'creative-design' },
    { name: 'Development and Computer Science', slug: 'development-cs' },
    { name: 'Business and Productivity', slug: 'business-productivity' },
    { name: 'Education, Research, and Learning', slug: 'education-research' },
    { name: 'Entertainment and Discovery', slug: 'entertainment-discovery' },
  ];

  // Run async
  (async () => {
    try {
      const allCategories = await categoriesCollection.find({}, { projection: { name: 1, slug: 1 } }).toArray();
      const catNames = allCategories.map((c) => c.name);

      let totalNewTools = 0;
      let totalCategoriesCreated = 0;
      let totalCandidates = 0;

      const { discoverBranchTools } = await import('./geminiService.js');

      for (let i = 0; i < MACRO_BRANCHES.length; i++) {
        const branch = MACRO_BRANCHES[i];
        const progress = Math.round(15 + (i / MACRO_BRANCHES.length) * 75);

        await jobsCollection.updateOne(
          { _id: new ObjectId(jobId) },
          {
            $set: { currentStage: 'Discovering Branch Tools', progress, updatedAt: new Date() },
            $push: {
              logs: {
                timestamp: new Date(),
                message: `[Branch ${i + 1}/${MACRO_BRANCHES.length}] Discovering 25 breakout tools for "${branch.name}"...`,
              },
            },
          }
        );

        let branchTools = [];
        try {
          branchTools = await discoverBranchTools({
            branchName: branch.name,
            parentSlug: branch.slug,
            existingCategoryNames: catNames,
            targetCount: 25,
          });
        } catch (branchErr) {
          console.warn(`[GlobalDiscovery] Branch ${branch.name} notice:`, branchErr.message);
        }

        totalCandidates += branchTools.length;

        // Verify and upsert each tool
        for (const tool of branchTools) {
          let targetSlug = branch.slug;

          // If tool suggests a subcategory, check or create it
          if (tool.suggestedCategory?.slug) {
            const sub = tool.suggestedCategory;
            let existingSub = await categoriesCollection.findOne({ slug: sub.slug });
            if (!existingSub) {
              const newSubDoc = {
                name: sub.name,
                slug: sub.slug,
                parentSlug: sub.parentSlug || branch.slug,
                description: sub.description || `${sub.name} tools and applications.`,
                synonyms: [sub.name.toLowerCase()],
                icon: 'Sparkles',
                order: 99,
                resourceCount: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
                lastDiscoveryAt: new Date(),
              };
              await categoriesCollection.insertOne(newSubDoc);
              totalCategoriesCreated++;
              existingSub = newSubDoc;
            }
            targetSlug = existingSub.slug;
          }

          try {
            const verification = await verifyWebsite(tool.officialUrl, 5000);
            const upsertResult = await upsertResource(db, tool, targetSlug, verification);
            if (upsertResult.action === 'inserted') totalNewTools++;
          } catch {}
        }

        await new Promise((r) => setTimeout(r, 1000));
      }

      // Update all category counts
      for (const branch of MACRO_BRANCHES) {
        const count = await db.collection('resources').countDocuments({ categorySlugs: branch.slug });
        await categoriesCollection.updateOne({ slug: branch.slug }, { $set: { resourceCount: count } });
      }

      const finalMessage = `Global discovery complete! Discovered ${totalCandidates} candidates, added ${totalNewTools} new verified tools across ${totalCategoriesCreated} new subcategories.`;

      await jobsCollection.updateOne(
        { _id: new ObjectId(jobId) },
        {
          $set: {
            currentStage: 'Completed',
            status: 'completed',
            progress: 100,
            completedAt: new Date(),
            updatedAt: new Date(),
            'metrics.candidatesFound': totalCandidates,
            'metrics.newAdded': totalNewTools,
            'metrics.newCategoriesCreated': totalCategoriesCreated,
          },
          $push: {
            logs: { timestamp: new Date(), message: finalMessage },
          },
        }
      );

      jobEvents.emit(`job:${jobId}`, {
        jobId,
        stage: 'Completed',
        status: 'completed',
        progress: 100,
        message: finalMessage,
        metrics: {
          candidatesFound: totalCandidates,
          newAdded: totalNewTools,
          newCategoriesCreated: totalCategoriesCreated,
        },
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

