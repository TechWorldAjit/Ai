import React, { useState, useMemo } from 'react';
import {
  Folder,
  ChevronRight,
  ChevronDown,
  Layers,
  Bot,
  Palette,
  Terminal,
  Briefcase,
  GraduationCap,
  Sparkles,
  Search,
  Hash,
  Trash2,
  Pin,
} from 'lucide-react';

// Icon resolver helper
const ICON_MAP = {
  Bot,
  Palette,
  Terminal,
  Briefcase,
  GraduationCap,
  Sparkles,
  Layers,
  Folder,
};

export default function Sidebar({
  categories = [],
  selectedCategory,
  onSelectCategory,
  totalToolsCount = 0,
  isOpen,
  onClose,
  onOpenDeleteCategory,
  pinnedCategorySlugs = new Set(),
  onTogglePinCategory,
}) {
  const [filterQuery, setFilterQuery] = useState('');
  const [expandedParents, setExpandedParents] = useState(() => {
    // Expand the parent of the currently selected category or first parent by default
    return new Set(['ai-tools', 'creative-design', 'development-cs', 'business-productivity']);
  });

  // Flat map to quickly find category metadata by slug
  const allCategoriesMap = useMemo(() => {
    const map = new Map();
    categories.forEach((parent) => {
      map.set(parent.slug, { ...parent, isParent: true });
      if (parent.subcategories) {
        parent.subcategories.forEach((sub) => {
          map.set(sub.slug, { ...sub, isParent: false, parentName: parent.name });
        });
      }
    });
    return map;
  }, [categories]);

  // Pinned categories list in order of selection (supports unlimited pins)
  const pinnedCategories = useMemo(() => {
    if (!pinnedCategorySlugs || pinnedCategorySlugs.size === 0) return [];
    const list = [];
    pinnedCategorySlugs.forEach((slug) => {
      const cat = allCategoriesMap.get(slug);
      if (cat) list.push(cat);
    });
    return list;
  }, [allCategoriesMap, pinnedCategorySlugs]);

  const toggleExpand = (slug) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  // Filter categories based on search input
  const filteredCategories = categories.map((parent) => {
    const parentMatches = parent.name.toLowerCase().includes(filterQuery.toLowerCase());
    const matchedSubs = (parent.subcategories || []).filter(
      (sub) =>
        sub.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
        parentMatches
    );

    if (parentMatches || matchedSubs.length > 0) {
      return {
        ...parent,
        subcategories: matchedSubs,
        forceOpen: filterQuery.trim().length > 0,
      };
    }
    return null;
  }).filter(Boolean);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 transform border-r border-border bg-surface flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Category Search Header */}
        <div className="p-3.5 border-b border-border/80">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter categories..."
              className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-xs text-gray-200 placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
            />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-300"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Categories Tree Navigation */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
          {/* "All Directory" Root Item */}
          <button
            onClick={() => {
              onSelectCategory(null);
              onClose();
            }}
            className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
              !selectedCategory
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-gray-300 hover:bg-surface-elevated hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-400" />
              <span>All Directory Resources</span>
            </div>
            <span className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-[10px] text-gray-400">
              {totalToolsCount}
            </span>
          </button>

          {/* Pinned Categories Section (Unlimited Pinned Categories) */}
          {pinnedCategories.length > 0 && (
            <div className="pt-2 pb-1 border-b border-border/50 mb-2">
              <div className="px-1 pb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                <span className="flex items-center gap-1.5">
                  <Pin className="h-3 w-3 fill-amber-400 text-amber-400" />
                  Pinned Categories
                </span>
                <span className="font-mono text-gray-400 text-[10px]">({pinnedCategories.length})</span>
              </div>
              <div className="space-y-0.5">
                {pinnedCategories.map((cat) => {
                  const isSelected = selectedCategory === cat.slug;
                  const IconComponent = cat.isParent ? (ICON_MAP[cat.icon] || Folder) : Hash;
                  return (
                    <div
                      key={`pinned-${cat.slug}`}
                      className={`group flex items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-colors ${
                        isSelected
                          ? 'bg-amber-500/20 text-amber-200 font-semibold border border-amber-500/30'
                          : 'text-gray-300 hover:bg-surface-elevated hover:text-white'
                      }`}
                    >
                      <button
                        onClick={() => {
                          onSelectCategory(cat.slug);
                          onClose();
                        }}
                        className="flex flex-1 items-center gap-2 truncate text-left"
                      >
                        <IconComponent
                          className={`h-3.5 w-3.5 shrink-0 ${
                            isSelected ? 'text-amber-400' : 'text-gray-400 group-hover:text-amber-400'
                          } transition-colors`}
                        />
                        <div className="truncate flex-1">
                          <span className="truncate">{cat.name}</span>
                          {!cat.isParent && cat.parentName && (
                            <span className="text-[9px] text-gray-500 block truncate">
                              {cat.parentName}
                            </span>
                          )}
                        </div>
                      </button>

                      <div className="flex items-center gap-1">
                        {onTogglePinCategory && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onTogglePinCategory(cat.slug);
                            }}
                            className="p-1 text-amber-400 hover:text-amber-300 transition-colors"
                            title={`Unpin category "${cat.name}"`}
                          >
                            <Pin className="h-3 w-3 fill-amber-400" />
                          </button>
                        )}
                        {cat.resourceCount > 0 && (
                          <span className="rounded bg-surface-elevated px-1.5 py-0.2 font-mono text-[10px] text-gray-400">
                            {cat.resourceCount}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-2 pb-1 px-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Categories & Fields
            </span>
          </div>

          {filteredCategories.map((parent) => {
            const isExpanded = parent.forceOpen || expandedParents.has(parent.slug);
            const isSelected = selectedCategory === parent.slug;
            const IconComponent = ICON_MAP[parent.icon] || Folder;
            const subCount = (parent.subcategories || []).length;
            const isParentPinned = pinnedCategorySlugs.has(parent.slug);

            return (
              <div key={parent.slug} className="space-y-0.5">
                {/* Parent Row */}
                <div
                  className={`group flex items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-colors ${
                    isSelected
                      ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30'
                      : 'text-gray-300 hover:bg-surface-elevated hover:text-white'
                  }`}
                >
                  <button
                    onClick={() => {
                      onSelectCategory(parent.slug);
                      onClose();
                    }}
                    className="flex flex-1 items-center gap-2 truncate text-left"
                  >
                    <IconComponent className="h-3.5 w-3.5 shrink-0 text-gray-400 group-hover:text-indigo-400 transition-colors" />
                    <span className="truncate">{parent.name}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {onTogglePinCategory && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePinCategory(parent.slug);
                        }}
                        className={`p-1 rounded transition-opacity ${
                          isParentPinned
                            ? 'opacity-100 text-amber-400 hover:text-amber-300'
                            : 'opacity-0 group-hover:opacity-100 text-gray-500 hover:text-amber-300'
                        }`}
                        title={isParentPinned ? `Unpin category "${parent.name}"` : `Pin category "${parent.name}"`}
                      >
                        <Pin className={`h-3 w-3 ${isParentPinned ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>
                    )}
                    {onOpenDeleteCategory && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDeleteCategory(parent);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-rose-400 rounded transition-opacity"
                        title={`Delete category "${parent.name}"`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                    {parent.resourceCount > 0 && (
                      <span className="rounded bg-surface-elevated px-1.5 py-0.2 font-mono text-[10px] text-gray-400">
                        {parent.resourceCount}
                      </span>
                    )}
                    {subCount > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(parent.slug);
                        }}
                        className="rounded p-1 text-gray-500 hover:text-gray-300 hover:bg-surface-hover"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Subcategories */}
                {isExpanded && subCount > 0 && (
                  <div className="ml-4 pl-2 border-l border-border/60 space-y-0.5">
                    {parent.subcategories.map((sub) => {
                      const isSubSelected = selectedCategory === sub.slug;
                      const isSubPinned = pinnedCategorySlugs.has(sub.slug);
                      return (
                        <div
                          key={sub.slug}
                          className={`group/sub flex items-center justify-between rounded-md px-2 py-1 text-[11px] transition-colors truncate ${
                            isSubSelected
                              ? 'bg-indigo-500/25 text-indigo-200 font-medium'
                              : 'text-gray-400 hover:bg-surface-elevated hover:text-gray-200'
                          }`}
                        >
                          <button
                            onClick={() => {
                              onSelectCategory(sub.slug);
                              onClose();
                            }}
                            className="truncate flex-1 text-left"
                          >
                            {sub.name}
                          </button>
                          <div className="flex items-center gap-1">
                            {onTogglePinCategory && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onTogglePinCategory(sub.slug);
                                }}
                                className={`p-0.5 rounded transition-opacity ${
                                  isSubPinned
                                    ? 'opacity-100 text-amber-400 hover:text-amber-300'
                                    : 'opacity-0 group-hover/sub:opacity-100 text-gray-500 hover:text-amber-300'
                                }`}
                                title={isSubPinned ? `Unpin category "${sub.name}"` : `Pin category "${sub.name}"`}
                              >
                                <Pin className={`h-2.5 w-2.5 ${isSubPinned ? 'fill-amber-400 text-amber-400' : ''}`} />
                              </button>
                            )}
                            {onOpenDeleteCategory && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenDeleteCategory(sub);
                                }}
                                className="opacity-0 group-hover/sub:opacity-100 p-0.5 text-gray-500 hover:text-rose-400 rounded transition-opacity"
                                title={`Delete "${sub.name}"`}
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </button>
                            )}
                            {sub.resourceCount > 0 && (
                              <span className="rounded bg-surface-elevated/80 px-1 py-0.2 font-mono text-[9px] text-gray-400">
                                {sub.resourceCount}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Info */}
        <div className="p-3 border-t border-border/80 text-[11px] text-gray-400 flex items-center justify-between">
          <span>Permanent DB: MongoDB</span>
          <span className="text-emerald-400 font-mono flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Active
          </span>
        </div>
      </aside>
    </>
  );
}

