import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

export default function Breadcrumb({ breadcrumbs = [], onSelectCategory }) {
  if (!breadcrumbs || breadcrumbs.length <= 1) return null;

  return (
    <nav className="flex items-center space-x-1.5 text-xs text-gray-400 mb-3 overflow-x-auto py-1">
      <button
        onClick={() => onSelectCategory(null)}
        className="flex items-center gap-1 hover:text-white transition-colors"
      >
        <Home className="h-3.5 w-3.5" />
        <span>Directory</span>
      </button>

      {breadcrumbs.slice(1).map((crumb, idx) => {
        const isLast = idx === breadcrumbs.length - 2;
        return (
          <React.Fragment key={crumb.slug || idx}>
            <ChevronRight className="h-3 w-3 text-gray-600 shrink-0" />
            <button
              onClick={() => onSelectCategory(crumb.slug)}
              className={`hover:text-white transition-colors truncate max-w-[150px] ${
                isLast ? 'text-indigo-300 font-semibold' : 'text-gray-400'
              }`}
            >
              {crumb.name}
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

