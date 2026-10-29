import React from 'react';
import { Sparkles, RefreshCw, Clock, ShieldCheck } from 'lucide-react';

export default function CategoryHeader({
  category,
  totalCount = 0,
  onTriggerUpdate,
  isUpdating = false,
}) {
  const title = category?.name || 'All Digital Tools & Web Applications';
  const description =
    category?.description ||
    'Comprehensive verified directory of modern software, AI applications, developer platforms, and online utilities.';

  const lastDiscovery = category?.lastDiscoveryAt
    ? new Date(category.lastDiscoveryAt).toLocaleString()
    : 'Recently verified';

  return (
    <div className="mb-6 rounded-xl border border-border bg-gradient-to-r from-surface to-surface-elevated p-5 shadow-lg">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Title & Scope */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl truncate">
              {title}
            </h1>
            <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 font-mono text-xs font-semibold text-indigo-300 border border-indigo-500/30">
              {totalCount} {totalCount === 1 ? 'Resource' : 'Resources'}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-gray-400 leading-relaxed max-w-3xl">
            {description}
          </p>
          <div className="mt-2.5 flex items-center gap-4 text-[11px] text-gray-500">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-gray-400" />
              <span>Last Research Cycle: {lastDiscovery}</span>
            </span>
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Multi-Source Verified</span>
            </span>
          </div>
        </div>

        {/* Update Button (Required prominent feature) */}
        {category && (
          <div className="shrink-0">
            <button
              onClick={() => onTriggerUpdate(category.slug)}
              disabled={isUpdating}
              className={`group relative flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] ${
                isUpdating ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              <Sparkles className={`h-4 w-4 text-cyan-200 ${isUpdating ? 'animate-spin' : 'group-hover:rotate-12 transition-transform'}`} />
              <span>{isUpdating ? 'Researching Live Web...' : 'Update Category with Gemini'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

