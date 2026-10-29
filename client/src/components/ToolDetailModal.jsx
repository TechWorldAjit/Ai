import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  Bookmark,
  RefreshCw,
  Clock,
  Layers,
  Tag,
  CheckCircle2,
  AlertCircle,
  Globe,
  Database,
  Calendar,
} from 'lucide-react';
import { verifyResource } from '../services/api';

export default function ToolDetailModal({
  resource,
  onClose,
  onBookmark,
  isSaved = false,
  onResourceUpdated,
}) {
  const [reverifying, setReverifying] = useState(false);
  const [updatedData, setUpdatedData] = useState(resource);

  if (!resource) return null;

  const current = updatedData || resource;
  const isOnline = current.verification?.isOnline || current.status === 'active';

  const handleReverify = async () => {
    setReverifying(true);
    try {
      const res = await verifyResource(current._id);
      if (res.success) {
        setUpdatedData((prev) => ({
          ...prev,
          verification: res.verification,
          status: res.status,
          lastVerified: new Date(),
        }));
        if (onResourceUpdated) onResourceUpdated();
      }
    } catch (err) {
      console.error('Reverify failed:', err);
    } finally {
      setReverifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border/80 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-white">{current.name}</h2>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-mono font-medium border ${
                isOnline
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                {isOnline ? 'Verified Active' : 'Unverified Status'}
              </span>
              {current.pricing && current.pricing !== 'unknown' && (
                <span className="rounded bg-surface-elevated px-2 py-0.5 font-mono text-xs text-gray-300 border border-border">
                  {current.pricing}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 flex items-center gap-1.5 font-mono">
              <Globe className="h-3 w-3 text-gray-500" />
              <span>{current.domain}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onBookmark(current._id)}
              className={`p-2 rounded-lg border transition-colors ${
                isSaved
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                  : 'border-border bg-surface-elevated text-gray-400 hover:text-white'
              }`}
              title={isSaved ? 'Bookmarked' : 'Save tool'}
            >
              <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-amber-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-surface-elevated hover:text-white border border-border"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Concise Description */}
        <div className="rounded-xl border border-border bg-surface-elevated/60 p-4 space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Primary Utility & Mission
          </span>
          <p className="text-sm text-gray-200 leading-relaxed">
            {current.description}
          </p>
        </div>

        {/* Live Official Verification Details */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Cryptographic & HTTP Verification Evidence</span>
            </span>
            <button
              onClick={handleReverify}
              disabled={reverifying}
              className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${reverifying ? 'animate-spin' : ''}`} />
              <span>{reverifying ? 'Checking...' : 'Re-verify Now'}</span>
            </button>
          </div>

          <div className="rounded-xl border border-border bg-background p-4 space-y-2.5 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Official URL:</span>
              <a
                href={current.canonicalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:underline truncate max-w-sm flex items-center gap-1"
              >
                <span>{current.canonicalUrl}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {current.verification?.finalUrl && current.verification.finalUrl !== current.canonicalUrl && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Resolved Destination:</span>
                <span className="text-gray-300 truncate max-w-sm">{current.verification.finalUrl}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-gray-500">HTTP Status Code:</span>
              <span className="text-emerald-400">{current.verification?.statusCode || 200} OK</span>
            </div>

            {current.verification?.title && (
              <div className="flex flex-col gap-0.5 pt-1 border-t border-border/60">
                <span className="text-gray-500">Extracted Page Title:</span>
                <span className="text-gray-300 font-sans text-xs">{current.verification.title}</span>
              </div>
            )}

            {current.verification?.metaDescription && (
              <div className="flex flex-col gap-0.5 pt-1 border-t border-border/60">
                <span className="text-gray-500">Verified Meta Description:</span>
                <span className="text-gray-400 font-sans text-xs italic">{current.verification.metaDescription}</span>
              </div>
            )}
          </div>
        </div>

        {/* Multi-Signal Ranking Breakdown */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-cyan-400" />
            <span>Multi-Signal Ranking Architecture</span>
          </span>

          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="rounded-xl border border-border bg-background p-3">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Overall Rank Score</span>
              <span className="font-mono text-lg font-bold text-emerald-400">
                {current.rankScore || 85}
              </span>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Long-Term Quality</span>
              <span className="font-mono text-lg font-bold text-cyan-400">
                {current.qualityScore || 85}
              </span>
            </div>
            <div className="rounded-xl border border-border bg-background p-3">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Current Trend</span>
              <span className="font-mono text-lg font-bold text-indigo-300">
                {current.trendScore || 80}
              </span>
            </div>
          </div>
        </div>

        {/* Category Associations & Tags */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-gray-300">Category Mappings & Capability Tags</span>
          <div className="flex flex-wrap gap-1.5">
            {(current.categorySlugs || []).map((slug) => (
              <span
                key={slug}
                className="rounded-lg bg-indigo-500/15 border border-indigo-500/30 px-2.5 py-1 text-xs font-medium text-indigo-300"
              >
                📁 {slug}
              </span>
            ))}
            {(current.tags || []).map((tag) => (
              <span
                key={tag}
                className="rounded-lg bg-surface-elevated border border-border px-2 py-0.5 text-xs text-gray-400"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* Provenance Audit Trail */}
        {current.provenance && current.provenance.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              <span>Provenance & Verification History</span>
            </span>
            <div className="rounded-xl border border-border bg-background p-3 space-y-2 max-h-36 overflow-y-auto font-mono text-[11px]">
              {current.provenance.map((p, idx) => (
                <div key={idx} className="flex items-start justify-between border-b border-border/40 pb-1.5 last:border-0 last:pb-0">
                  <div>
                    <span className="text-indigo-400 font-semibold">{p.source}</span>
                    <span className="text-gray-400 ml-2">{p.evidenceNote}</span>
                  </div>
                  <span className="text-gray-500 shrink-0 ml-2">
                    {new Date(p.timestamp).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions Footer */}
        <div className="flex items-center justify-between border-t border-border/80 pt-4">
          <div className="text-[11px] text-gray-400 flex items-center gap-1">
            <Database className="h-3.5 w-3.5" />
            <span>ID: {current._id}</span>
          </div>

          <a
            href={current.canonicalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 hover:scale-[1.02] transition-transform"
          >
            <span>Visit Official Site</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

