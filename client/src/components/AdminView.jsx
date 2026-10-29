import React, { useEffect, useState } from 'react';
import {
  Activity,
  Database,
  Bot,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { fetchAdminStats } from '../services/api';

export default function AdminView({ onOpenGlobalDiscovery }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async () => {
    try {
      const res = await fetchAdminStats();
      setData(res.stats);
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent mb-3" />
        <p className="text-xs text-gray-400">Loading system observability telemetry...</p>
      </div>
    );
  }

  const { resources, categories, jobs, system, recentAuditLogs = [], recentJobs = [] } = data || {};

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">System & Discovery Observability</h1>
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-400 border border-emerald-500/30">
              OPERATIONAL
            </span>
          </div>
          <p className="text-xs text-gray-400">
            Real-time telemetry, database capacity, Gemini API research runs, and audit logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setRefreshing(true);
              loadStats();
            }}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-elevated px-3 py-2 text-xs text-gray-300 hover:text-white hover:bg-surface-hover"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={onOpenGlobalDiscovery}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 hover:scale-[1.02] transition-transform"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Discover New Tools & Categories</span>
          </button>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Resources */}
        <div className="rounded-xl border border-border bg-surface p-4 space-y-1">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>Permanent Entries</span>
            <Database className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="font-mono text-2xl font-bold text-white">
            {resources?.total || 0}
          </div>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
            <CheckCircle2 className="h-3 w-3" />
            <span>{resources?.active || 0} verified active ({resources?.activePercentage}%)</span>
          </div>
        </div>

        {/* Dynamic Categories */}
        <div className="rounded-xl border border-border bg-surface p-4 space-y-1">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>Taxonomy Categories</span>
            <Layers className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="font-mono text-2xl font-bold text-white">
            {categories?.total || 0}
          </div>
          <div className="text-[11px] text-gray-400 font-mono">
            Hierarchical parent-child tree
          </div>
        </div>

        {/* Duplicates Prevented */}
        <div className="rounded-xl border border-border bg-surface p-4 space-y-1">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>Duplicates Prevented</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="font-mono text-2xl font-bold text-emerald-400">
            {jobs?.totalDuplicatesPrevented || 0}
          </div>
          <div className="text-[11px] text-gray-400 font-mono">
            Strict URL & entity deduplication
          </div>
        </div>

        {/* Gemini Intelligence Engine */}
        <div className="rounded-xl border border-border bg-surface p-4 space-y-1">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>AI Model Engine</span>
            <Bot className="h-4 w-4 text-violet-400" />
          </div>
          <div className="font-mono text-sm font-bold text-indigo-300 truncate mt-1">
            {system?.geminiModel}
          </div>
          <div className="text-[11px] text-gray-400 font-mono">
            DB: {system?.databaseName}
          </div>
        </div>
      </div>

      {/* Two Column Layout: Recent Discovery Jobs & Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Discovery Jobs */}
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-border/80 pb-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              <span>Recent Background Discovery Jobs</span>
            </h3>
            <span className="font-mono text-[11px] text-gray-400">
              Total Runs: {jobs?.total || 0}
            </span>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {recentJobs.length === 0 ? (
              <p className="text-xs text-gray-500 py-4 text-center">No background jobs executed yet.</p>
            ) : (
              recentJobs.map((j) => (
                <div
                  key={j._id}
                  className="rounded-xl border border-border/70 bg-background p-3 text-xs flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-200">
                        {j.targetCategoryName || j.targetCategorySlug}
                      </span>
                      <span className={`rounded px-1.5 py-0.2 font-mono text-[10px] ${
                        j.status === 'completed'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : j.status === 'failed'
                          ? 'bg-rose-500/15 text-rose-400'
                          : 'bg-indigo-500/15 text-indigo-300'
                      }`}>
                        {j.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      +{j.metrics?.newAdded ?? 0} new tools • {j.metrics?.duplicatesRejected ?? 0} duplicates
                    </p>
                  </div>
                  <span className="font-mono text-[10px] text-gray-500">
                    {new Date(j.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Audit Logs */}
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-border/80 pb-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-indigo-400" />
              <span>Immutable Audit Trail</span>
            </h3>
            <span className="font-mono text-[11px] text-emerald-400">
              Preserve Forever Rule: ACTIVE
            </span>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto font-mono text-[11px]">
            {recentAuditLogs.length === 0 ? (
              <p className="text-xs text-gray-500 py-4 text-center">No audit entries found.</p>
            ) : (
              recentAuditLogs.map((log) => (
                <div
                  key={log._id}
                  className="rounded-lg border border-border/60 bg-background p-2.5 flex items-start justify-between gap-3"
                >
                  <div className="truncate">
                    <span className="text-cyan-400 font-semibold">[{log.action}]</span>{' '}
                    <span className="text-gray-200">{log.resourceName}</span>
                    {log.addedCategory && (
                      <span className="text-gray-500 ml-1">→ {log.addedCategory}</span>
                    )}
                  </div>
                  <span className="text-gray-500 shrink-0 text-[10px]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

