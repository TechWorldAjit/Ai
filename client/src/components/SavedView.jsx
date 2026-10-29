import React from 'react';
import { Bookmark, ExternalLink, Trash2, ArrowLeft } from 'lucide-react';

export default function SavedView({
  savedResources = [],
  onSelectResource,
  onRemoveBookmark,
  onBackToDirectory,
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={onBackToDirectory}
              className="text-gray-400 hover:text-white p-1 rounded-md"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-xl font-bold text-white">Bookmarked Tools & Resources</h1>
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 font-mono text-xs font-semibold text-amber-300 border border-amber-500/30">
              {savedResources.length}
            </span>
          </div>
          <p className="text-xs text-gray-400 ml-7">
            Your personal saved collection of tools, applications, and web services.
          </p>
        </div>
      </div>

      {savedResources.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-16 text-center bg-surface/40">
          <Bookmark className="mx-auto h-8 w-8 text-gray-500 mb-2" />
          <h3 className="text-sm font-semibold text-gray-200">No saved tools yet</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1 mb-4">
            Click the bookmark icon on any tool row in the directory to save it to this collection.
          </p>
          <button
            onClick={onBackToDirectory}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            Explore Directory
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {savedResources.map((item) => (
            <div
              key={item._id}
              onClick={() => onSelectResource(item)}
              className="rounded-xl border border-border bg-surface p-4 flex flex-col justify-between hover:border-indigo-500/50 hover:bg-surface-elevated transition-all cursor-pointer group shadow-sm"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                      {item.name}
                    </h3>
                    <span className="font-mono text-[10px] text-gray-500">{item.domain}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveBookmark(item._id);
                    }}
                    className="p-1 text-gray-500 hover:text-rose-400 transition-colors"
                    title="Remove from saved"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-border/60 pt-3 mt-4 text-xs">
                <span className="font-mono text-emerald-400 font-semibold text-[11px]">
                  Rank #{item.rank || 1} • Score: {item.rankScore || 85}
                </span>
                <a
                  href={item.canonicalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-gray-400 hover:text-cyan-400 text-[11px]"
                >
                  <span>Visit</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

