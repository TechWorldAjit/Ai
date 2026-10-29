import React, { useEffect, useState, useRef } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Terminal,
  Activity,
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { fetchJob, subscribeToJobStream } from '../services/api';

const STAGES = [
  'Queued',
  'Searching',
  'Evaluating',
  'Verifying Links',
  'Removing Duplicate Candidates',
  'Recalculating Rankings',
  'Completed',
];

export default function JobProgressDrawer({
  jobId,
  onClose,
  onJobComplete,
}) {
  const [job, setJob] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const logsEndRef = useRef(null);

  useEffect(() => {
    if (!jobId) return;

    let isMounted = true;

    // Initial fetch
    fetchJob(jobId)
      .then((data) => {
        if (!isMounted) return;
        setJob(data.job);
        setLogs(data.job.logs || []);
        if (data.job.status === 'completed' || data.job.status === 'failed') {
          setIsCompleted(true);
        }
      })
      .catch((err) => console.error('Failed to fetch job:', err));

    // Connect SSE stream for real-time live terminal updates
    const unsubscribe = subscribeToJobStream(
      jobId,
      (update) => {
        if (!isMounted) return;
        setJob((prev) => ({
          ...prev,
          currentStage: update.stage,
          progress: update.progress,
          status: update.status || prev?.status,
          metrics: update.metrics ? { ...prev?.metrics, ...update.metrics } : prev?.metrics,
        }));
        setLogs((prev) => [
          ...prev,
          { timestamp: update.timestamp || new Date(), stage: update.stage, message: update.message },
        ]);
      },
      (completeData) => {
        if (!isMounted) return;
        setIsCompleted(true);
        if (onJobComplete) onJobComplete(completeData);
      },
      (err) => {
        // Fallback polling if SSE disconnects
        const interval = setInterval(() => {
          fetchJob(jobId).then((data) => {
            if (!isMounted) return;
            setJob(data.job);
            setLogs(data.job.logs || []);
            if (data.job.status === 'completed' || data.job.status === 'failed') {
              setIsCompleted(true);
              clearInterval(interval);
              if (onJobComplete) onJobComplete(data.job);
            }
          });
        }, 2000);
        return () => clearInterval(interval);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [jobId]);

  // Auto scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (!jobId) return null;

  const currentStage = job?.currentStage || 'Queued';
  const progressPercent = job?.progress || 10;
  const isFailed = job?.status === 'failed';
  const isWarning = job?.status === 'completed_with_warnings';

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-surface border-l border-border shadow-2xl flex flex-col">
      {/* Drawer Header */}
      <div className="flex items-center justify-between border-b border-border p-4 bg-surface-elevated">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
            <Sparkles className="h-4 w-4 animate-spin" />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-white">Gemini AI Discovery Cycle</h2>
            <p className="text-[11px] text-gray-400 truncate max-w-xs">
              Target: <span className="text-indigo-300 font-mono">{job?.targetCategoryName || 'Global'}</span>
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-surface hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress & Stages */}
      <div className="p-4 border-b border-border/70 space-y-3 bg-surface/40">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-gray-300 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-cyan-400" />
            <span>{currentStage}</span>
          </span>
          <span className="font-mono text-indigo-300 font-bold">{progressPercent}%</span>
        </div>

        {/* Progress Bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-background border border-border/80">
          <div
            className={`h-full transition-all duration-300 ease-out ${
              isFailed
                ? 'bg-rose-500'
                : isCompleted
                ? 'bg-emerald-500'
                : 'bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-400'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Stage Pills */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {STAGES.map((stg) => {
            const isPast = STAGES.indexOf(currentStage) > STAGES.indexOf(stg) || isCompleted;
            const isCurrent = currentStage.toLowerCase() === stg.toLowerCase() && !isCompleted;

            return (
              <span
                key={stg}
                className={`rounded px-2 py-0.5 text-[10px] font-mono border transition-colors ${
                  isCurrent
                    ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/50 animate-pulse'
                    : isPast
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-background text-gray-500 border-border/60'
                }`}
              >
                {stg}
              </span>
            );
          })}
        </div>
      </div>

      {/* Finished Summary Audit Metrics */}
      {isCompleted && (
        <div className="p-4 border-b border-border bg-surface-elevated/40">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <h3 className="text-xs font-semibold text-white">Discovery & Verification Report</h3>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-border bg-background p-2.5">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Genuinely New Tools</span>
              <span className="font-mono text-base font-bold text-emerald-400">
                +{job?.metrics?.newAdded ?? 0}
              </span>
            </div>
            <div className="rounded-lg border border-border bg-background p-2.5">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Re-Verified Existing</span>
              <span className="font-mono text-base font-bold text-cyan-400">
                {job?.metrics?.reverified ?? 0}
              </span>
            </div>
            <div className="rounded-lg border border-border bg-background p-2.5">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Duplicates Prevented</span>
              <span className="font-mono text-base font-bold text-indigo-300">
                {job?.metrics?.duplicatesRejected ?? 0}
              </span>
            </div>
            <div className="rounded-lg border border-border bg-background p-2.5">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Failed / Broken Links</span>
              <span className="font-mono text-base font-bold text-amber-400">
                {job?.metrics?.failedChecks ?? 0}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Terminal Streaming Logs */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed bg-[#06070a] text-gray-300">
        <div className="flex items-center gap-1.5 text-gray-500 mb-2 border-b border-border/50 pb-1">
          <Terminal className="h-3 w-3 text-cyan-400" />
          <span>LIVE PIPELINE LOGS</span>
        </div>
        <div className="space-y-1.5">
          {logs.map((log, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="text-gray-600 shrink-0 select-none">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className="text-gray-300">{log.message}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border p-3 bg-surface-elevated flex items-center justify-between text-xs">
        <span className="text-gray-400 text-[11px]">
          {isCompleted ? 'Pipeline finished cleanly.' : 'Job executing in background...'}
        </span>
        <button
          onClick={onClose}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-gray-200 hover:bg-surface-hover"
        >
          {isCompleted ? 'Done & Close' : 'Keep Running in Background'}
        </button>
      </div>
    </div>
  );
}

