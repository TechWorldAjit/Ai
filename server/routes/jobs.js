import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../db/connection.js';
import {
  startCategoryDiscoveryJob,
  startGlobalDiscoveryJob,
  isCategoryUpdating,
  jobEvents,
} from '../services/jobManager.js';

const router = express.Router();

/**
 * POST /api/jobs/category-update
 * Initiates an asynchronous research update for a category.
 */
router.post('/category-update', async (req, res) => {
  try {
    const { categorySlug, targetCount = 100 } = req.body;

    if (!categorySlug) {
      return res.status(400).json({ success: false, error: 'categorySlug is required' });
    }

    if (isCategoryUpdating(categorySlug)) {
      return res.status(409).json({
        success: false,
        message: 'An update job is already actively running for this category.',
      });
    }

    // Default 100 tools minimum, up to 1000 tools per run
    const validatedTarget = Math.min(1000, Math.max(100, parseInt(targetCount, 10) || 100));

    const jobResult = await startCategoryDiscoveryJob({
      categorySlug,
      targetCount: validatedTarget,
      triggerSource: 'user_button',
    });

    res.json({
      success: true,
      jobId: jobResult.jobId,
      status: jobResult.status,
      message: `Research cycle started for category "${categorySlug}".`,
    });
  } catch (err) {
    console.error('[JobsRoute] Category update error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/jobs/global-discovery
 * Initiates an ecosystem-wide global discovery job.
 */
router.post('/global-discovery', async (req, res) => {
  try {
    const jobResult = await startGlobalDiscoveryJob();
    if (jobResult.isAlreadyRunning) {
      return res.status(409).json({
        success: false,
        jobId: jobResult.jobId,
        message: 'Global discovery is already in progress.',
      });
    }

    res.json({
      success: true,
      jobId: jobResult.jobId,
      message: 'Global discovery engine launched.',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/jobs/:id
 * Fetches the current progress, logs, metrics, and stage of a job.
 */
router.get('/:id', async (req, res) => {
  try {
    const db = getDB();
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid Job ID format' });
    }

    const job = await db.collection('discovery_jobs').findOne({ _id: new ObjectId(id) });
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/jobs/:id/stream
 * Server-Sent Events (SSE) stream for real-time live progress updates.
 */
router.get('/:id/stream', async (req, res) => {
  const id = req.params.id;
  if (!ObjectId.isValid(id)) {
    return res.status(400).end();
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  res.write(`data: ${JSON.stringify({ type: 'connected', jobId: id })}\n\n`);

  const onJobUpdate = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (data.stage === 'Completed' || data.stage === 'Failed') {
      cleanup();
    }
  };

  jobEvents.on(`job:${id}`, onJobUpdate);

  const cleanup = () => {
    jobEvents.removeListener(`job:${id}`, onJobUpdate);
    res.end();
  };

  req.on('close', cleanup);
});

/**
 * GET /api/jobs/active/all
 * Returns all active or recently queued jobs.
 */
router.get('/active/all', async (req, res) => {
  try {
    const db = getDB();
    const activeJobs = await db
      .collection('discovery_jobs')
      .find({ status: { $in: ['queued', 'searching', 'evaluating', 'verifying_links', 'removing_duplicate_candidates', 'recalculating_rankings'] } })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    res.json({ success: true, activeJobs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

