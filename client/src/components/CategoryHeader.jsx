import React, { useState } from 'react';
import { Sparkles, Trash2, Clock, ShieldCheck, Layers } from 'lucide-react';

export default function CategoryHeader({
  category,
  totalCount = 0,
  onTriggerUpdate,
  isUpdating = false,
  onOpenDeleteCategory,
}) {
  const [targetCount, setTargetCount] = useState(100);

  const title = category?.name || 'All Digital Tools & Web Applications';
  const description =
    category?.description ||
    'Comprehensive verified directory of modern software, AI applications, developer platforms, and online utilities.';

  const lastDiscovery = category?.lastDiscoveryAt
    ? new Date(category.lastDiscoveryAt).toLocaleString()
    : 'Recently verified';

  return (
    <div className="mb-6 rounded-xl border border-border bg-gradient-to-r from-surface to-surface-elevated p-5 shadow-lg">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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
          <div className="mt-2.5 flex items-center gap-4 text-[11px] text-gray-500 flex-wrap">
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

        {/* Action Controls for Category */}
        {category && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {/* Batch Target Selector (100, 250, 500, 1000) */}
            <div className="flex items-center rounded-xl border border-border bg-background px-2.5 py-1 text-xs">
              <span className="text-[11px] text-gray-400 mr-1.5 hidden sm:inline">Target:</span>
              <select
                value={targetCount}
                onChange={(e) => setTargetCount(Number(e.target.value))}
                className="bg-transparent text-indigo-300 font-mono font-semibold focus:outline-none cursor-pointer"
                title="Number of tools to discover and verify"
              >
                <option value={100} className="bg-surface text-white">100 Tools</option>
                <option value={250} className="bg-surface text-white">250 Tools</option>
                <option value={500} className="bg-surface text-white">500 Tools</option>
                <option value={1000} className="bg-surface text-white">1000 Tools</option>
              </select>
            </div>

            {/* Prominent Update Button */}
            <button
              onClick={() => onTriggerUpdate(category.slug, targetCount)}
              disabled={isUpdating}
              className={`group relative flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] ${
                isUpdating ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              <Sparkles className={`h-4 w-4 text-cyan-200 ${isUpdating ? 'animate-spin' : 'group-hover:rotate-12 transition-transform'}`} />
              <span>{isUpdating ? `Researching ${targetCount}+ Tools...` : `Update with Gemini (${targetCount}+)`}</span>
            </button>

            {/* Delete Category Button with Confirmation */}
            <button
              onClick={() => onOpenDeleteCategory(category)}
              className="p-2.5 rounded-xl border border-border/80 bg-surface text-gray-400 hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-500/10 transition-colors"
              title={`Delete category "${category.name}"`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
