import React from 'react';
import {
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  TrendingUp,
  Bookmark,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  Tag,
  Info,
} from 'lucide-react';

export default function DirectoryTable({
  resources = [],
  loading = false,
  sort,
  onSortChange,
  onSelectResource,
  onBookmark,
  savedResourceIds = new Set(),
}) {
  // Format relative time helper
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'Unverified';
    const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  if (loading && resources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent mb-3" />
        <p className="text-xs text-gray-400">Querying verified repository entries...</p>
      </div>
    );
  }

  if (resources.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center bg-surface/50">
        <AlertCircle className="mx-auto h-8 w-8 text-gray-500 mb-2" />
        <h3 className="text-sm font-semibold text-gray-200">No resources matched this query</h3>
        <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1">
          Try adjusting your search filters or click "Update Category with Gemini" to initiate an AI-assisted web discovery run.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border bg-surface-elevated/70 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              <th className="py-3 px-3 w-12 text-center">
                <button
                  onClick={() => onSortChange('rank')}
                  className="flex items-center gap-1 mx-auto hover:text-white"
                >
                  <span>Rank</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </button>
              </th>
              <th className="py-3 px-4 min-w-[220px]">
                <button
                  onClick={() => onSortChange('name')}
                  className="flex items-center gap-1 hover:text-white"
                >
                  <span>Website / Tool</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </button>
              </th>
              <th className="py-3 px-4 min-w-[300px]">Description</th>
              <th className="py-3 px-3 min-w-[140px] hidden md:table-cell">Tags</th>
              <th className="py-3 px-3 w-28 text-center">
                <button
                  onClick={() => onSortChange('trend')}
                  className="flex items-center gap-1 mx-auto hover:text-white"
                >
                  <span>Trend & Rank</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </button>
              </th>
              <th className="py-3 px-3 w-28 text-right hidden sm:table-cell">
                <button
                  onClick={() => onSortChange('verified')}
                  className="flex items-center gap-1 ml-auto hover:text-white"
                >
                  <span>Last Verified</span>
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </button>
              </th>
              <th className="py-3 px-3 w-16 text-center">Save</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {resources.map((item) => {
              const isSaved = savedResourceIds.has(item._id);
              const isVerifiedActive = item.status === 'active' || item.verification?.isOnline;

              return (
                <tr
                  key={item._id}
                  onClick={() => onSelectResource(item)}
                  className="group hover:bg-surface-elevated/80 transition-colors cursor-pointer"
                >
                  {/* Rank Column */}
                  <td className="py-3 px-3 text-center font-mono font-medium text-gray-400 group-hover:text-indigo-300">
                    #{item.rank || 1}
                  </td>

                  {/* Website / Tool Column */}
                  <td className="py-3 px-4">
                    <div className="flex items-start gap-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-gray-100 group-hover:text-indigo-300 transition-colors">
                            {item.name}
                          </span>
                          <a
                            href={item.canonicalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center text-gray-500 hover:text-cyan-400 transition-colors"
                            title={`Open official site: ${item.canonicalUrl}`}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[10px] text-gray-500 truncate max-w-[140px]">
                            {item.domain}
                          </span>
                          {item.pricing && item.pricing !== 'unknown' && (
                            <span className={`rounded px-1.5 py-0.2 font-mono text-[9px] font-medium border ${
                              item.pricing === 'free'
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                : item.pricing === 'freemium'
                                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
                                : item.pricing === 'open-source'
                                ? 'bg-violet-500/10 text-violet-300 border-violet-500/20'
                                : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                            }`}>
                              {item.pricing}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Description Column */}
                  <td className="py-3 px-4 text-gray-300 leading-relaxed text-xs">
                    <p className="line-clamp-2">{item.description}</p>
                  </td>

                  {/* Tags Column */}
                  <td className="py-3 px-3 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {(item.tags || []).slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] text-gray-400 border border-border/80"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Popularity / Trend Column */}
                  <td className="py-3 px-3 text-center">
                    <div className="inline-flex flex-col items-center">
                      <div className="flex items-center gap-1 font-mono text-xs font-semibold text-emerald-400">
                        <TrendingUp className="h-3 w-3" />
                        <span>{item.rankScore || 85}</span>
                      </div>
                      <div className="w-16 bg-surface-elevated rounded-full h-1 mt-1 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-1 rounded-full"
                          style={{ width: `${Math.min(100, item.rankScore || 85)}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Last Verified Column */}
                  <td className="py-3 px-3 text-right hidden sm:table-cell">
                    <div className="flex items-center justify-end gap-1.5 text-[11px] text-gray-400">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isVerifiedActive ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-amber-400'
                        }`}
                        title={isVerifiedActive ? 'Verified live & active' : 'Unverified or challenge response'}
                      />
                      <span>{formatTimeAgo(item.lastVerified || item.updatedAt)}</span>
                    </div>
                  </td>

                  {/* Bookmark Column */}
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onBookmark(item._id);
                      }}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isSaved
                          ? 'text-amber-400 hover:text-amber-300 bg-amber-500/10'
                          : 'text-gray-500 hover:text-gray-200 hover:bg-surface-elevated'
                      }`}
                      title={isSaved ? 'Bookmarked' : 'Save tool'}
                    >
                      <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-amber-400' : ''}`} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

