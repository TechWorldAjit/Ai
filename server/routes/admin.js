import express from 'express';
import { getDB } from '../db/connection.js';

const router = express.Router();

/**
 * GET /api/admin/stats
 * Overview metrics on directory scale, verification health, jobs, and audits.
 */
router.get('/stats', async (req, res) => {
  try {
    const db = getDB();

    const [
      totalResources,
      activeResources,
      unverifiedResources,
      brokenResources,
      totalCategories,
      totalJobs,
      completedJobs,
      failedJobs,
      recentAuditLogs,
      recentJobs,
    ] = await Promise.all([
      db.collection('resources').countDocuments(),
      db.collection('resources').countDocuments({ status: 'active' }),
      db.collection('resources').countDocuments({ status: 'unverified' }),
      db.collection('resources').countDocuments({ status: 'broken' }),
      db.collection('categories').countDocuments(),
      db.collection('discovery_jobs').countDocuments(),
      db.collection('discovery_jobs').countDocuments({ status: { $in: ['completed', 'completed_with_warnings'] } }),
      db.collection('discovery_jobs').countDocuments({ status: 'failed' }),
      db.collection('audit_logs').find().sort({ timestamp: -1 }).limit(20).toArray(),
      db.collection('discovery_jobs').find().sort({ createdAt: -1 }).limit(10).toArray(),
    ]);

    // Aggregate duplicate rejection & reverification counts across completed jobs
    const metricsAgg = await db.collection('discovery_jobs').aggregate([
      {
        $group: {
          _id: null,
          totalNewAdded: { $sum: '$metrics.newAdded' },
          totalReverified: { $sum: '$metrics.reverified' },
          totalDuplicatesPrevented: { $sum: '$metrics.duplicatesRejected' },
          totalFailedChecks: { $sum: '$metrics.failedChecks' },
        },
      },
    ]).toArray();

    const jobTotals = metricsAgg[0] || {
      totalNewAdded: 0,
      totalReverified: 0,
      totalDuplicatesPrevented: 0,
      totalFailedChecks: 0,
    };

    res.json({
      success: true,
      stats: {
        resources: {
          total: totalResources,
          active: activeResources,
          unverified: unverifiedResources,
          broken: brokenResources,
          activePercentage: totalResources > 0 ? Math.round((activeResources / totalResources) * 100) : 0,
        },
        categories: {
          total: totalCategories,
        },
        jobs: {
          total: totalJobs,
          completed: completedJobs,
          failed: failedJobs,
          successRate: totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 100,
          ...jobTotals,
        },
        system: {
          geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
          databaseName: process.env.DB_NAME || 'global_ai_directory',
          status: 'healthy',
        },
        recentAuditLogs,
        recentJobs,
      },
    });
  } catch (err) {
    console.error('[AdminRoute] stats error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

