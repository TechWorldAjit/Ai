import React from 'react';
import {
  Compass,
  Sparkles,
  PlusCircle,
  Bookmark,
  Activity,
  Menu,
  ShieldCheck,
  Search,
} from 'lucide-react';

export default function Header({
  activeView,
  setActiveView,
  onOpenAddCategory,
  onOpenGlobalDiscovery,
  savedCount = 0,
  stats = null,
  sidebarOpen,
  setSidebarOpen,
  globalSearch,
  setGlobalSearch,
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Mobile Toggle & Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-lg p-2 text-gray-400 hover:bg-surface-elevated hover:text-white lg:hidden"
            aria-label="Toggle Navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <button
            onClick={() => {
              setActiveView('directory');
              setGlobalSearch('');
            }}
            className="flex items-center gap-2.5 text-left group"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-0.5 shadow-lg shadow-indigo-500/20">
              <Compass className="h-5 w-5 text-white transition-transform group-hover:rotate-45" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-white text-base">APEX</span>
                <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-300 border border-indigo-500/30">
                  GLOBAL DIRECTORY
                </span>
              </div>
              <p className="text-[11px] text-gray-400 hidden sm:block">Living Index of Useful Software & AI</p>
            </div>
          </button>
        </div>

        {/* Center: Quick Global Search Input */}
        <div className="hidden md:flex flex-1 max-w-md mx-6">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => {
                setGlobalSearch(e.target.value);
                if (activeView !== 'directory') setActiveView('directory');
              }}
              placeholder="Search websites, AI tools, frameworks, tasks..."
              className="w-full rounded-lg border border-border bg-background/80 py-1.5 pl-9 pr-4 text-xs text-gray-200 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
            {globalSearch && (
              <button
                onClick={() => setGlobalSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-300"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Right: Actions & Navigation */}
        <div className="flex items-center gap-2">
          {/* Global Discovery Button */}
          <button
            onClick={onOpenGlobalDiscovery}
            className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-500/50 transition-all shadow-sm shadow-indigo-500/10"
            title="Scan internet for newly trending tools and categories"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
            <span className="hidden sm:inline">Discover New Tools</span>
          </button>

          {/* Add Category Button */}
          <button
            onClick={onOpenAddCategory}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-surface-hover hover:border-gray-600 transition-colors"
          >
            <PlusCircle className="h-3.5 w-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Add Category</span>
          </button>

          {/* Saved Bookmarks */}
          <button
            onClick={() => setActiveView(activeView === 'saved' ? 'directory' : 'saved')}
            className={`relative flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              activeView === 'saved'
                ? 'border-indigo-500 bg-indigo-500/20 text-white'
                : 'border-border bg-surface-elevated text-gray-300 hover:bg-surface-hover'
            }`}
            title="Saved Tools"
          >
            <Bookmark className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden md:inline">Bookmarks</span>
            {savedCount > 0 && (
              <span className="ml-1 rounded-full bg-amber-500/20 px-1.5 py-0.2 font-mono text-[10px] text-amber-300 font-semibold border border-amber-500/30">
                {savedCount}
              </span>
            )}
          </button>

          {/* Admin & System Stats */}
          <button
            onClick={() => setActiveView(activeView === 'admin' ? 'directory' : 'admin')}
            className={`flex items-center gap-1.5 rounded-lg border p-1.5 text-xs font-medium transition-colors ${
              activeView === 'admin'
                ? 'border-indigo-500 bg-indigo-500/20 text-white'
                : 'border-border bg-surface-elevated text-gray-400 hover:text-white hover:bg-surface-hover'
            }`}
            title="System & Discovery Observability"
          >
            <Activity className="h-4 w-4 text-emerald-400" />
          </button>
        </div>
      </div>
    </header>
  );
}

