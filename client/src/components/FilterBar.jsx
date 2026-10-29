import React from 'react';
import { Search, Filter, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

export default function FilterBar({
  search,
  setSearch,
  pricing,
  setPricing,
  status,
  setStatus,
  sort,
  setSort,
  pagination,
  onPageChange,
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-surface p-3 rounded-xl border border-border">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by name, description, tags, domain..."
          className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-8 text-xs text-gray-200 placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-300"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filter and Sort Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Pricing Filter */}
        <select
          value={pricing}
          onChange={(e) => setPricing(e.target.value)}
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-gray-300 focus:border-indigo-500 focus:outline-none"
        >
          <option value="all">Pricing: All</option>
          <option value="free">Free</option>
          <option value="freemium">Freemium</option>
          <option value="open-source">Open Source</option>
          <option value="paid">Paid</option>
        </select>

        {/* Status Filter */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-gray-300 focus:border-indigo-500 focus:outline-none"
        >
          <option value="">Status: Active Only</option>
          <option value="all">Status: All (Include Unverified)</option>
          <option value="unverified">Status: Unverified Only</option>
        </select>

        {/* Sort Filter */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-gray-300 focus:border-indigo-500 focus:outline-none font-medium"
        >
          <option value="rank">Sort: Category Rank</option>
          <option value="trend">Sort: Popularity & Trend</option>
          <option value="quality">Sort: Quality Score</option>
          <option value="newest">Sort: Newest Added</option>
          <option value="name">Sort: Alphabetical (A-Z)</option>
        </select>

        {/* Compact Pagination Controls */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center gap-1 pl-2 border-l border-border/80 text-xs text-gray-400">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="rounded p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 hover:bg-surface-elevated"
              title="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-mono text-[11px] px-1">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={!pagination.hasMore}
              className="rounded p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 hover:bg-surface-elevated"
              title="Next Page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

