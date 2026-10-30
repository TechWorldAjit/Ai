import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import DirectoryTable from './components/DirectoryTable';
import CategoryHeader from './components/CategoryHeader';
import Breadcrumb from './components/Breadcrumb';
import FilterBar from './components/FilterBar';
import JobProgressDrawer from './components/JobProgressDrawer';
import AddCategoryModal from './components/AddCategoryModal';
import ToolDetailModal from './components/ToolDetailModal';
import DeleteCategoryModal from './components/DeleteCategoryModal';
import AdminView from './components/AdminView';
import SavedView from './components/SavedView';

import {
  fetchCategories,
  fetchCategory,
  fetchResources,
  bookmarkResource,
  triggerCategoryUpdate,
  triggerGlobalDiscovery,
  deleteCategory,
} from './services/api';

export default function App() {
  // Navigation & View State
  const [activeView, setActiveView] = useState('directory'); // 'directory' | 'saved' | 'admin'
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Categories State
  const [categories, setCategories] = useState([]);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState(null);
  const [currentCategoryData, setCurrentCategoryData] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([]);

  // Resources Query State
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [pricing, setPricing] = useState('all');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('rank');
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });

  // Saved / Bookmarked Tools
  const [savedIds, setSavedIds] = useState(() => {
    try {
      const stored = localStorage.getItem('ajit_saved_tools') || localStorage.getItem('apex_saved_tools');
      return new Set(stored ? JSON.parse(stored) : []);
    } catch {
      return new Set();
    }
  });

  // Modals & Drawers
  const [activeJobId, setActiveJobId] = useState(null);
  const [isUpdatingCategory, setIsUpdatingCategory] = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  // Sync saved to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ajit_saved_tools', JSON.stringify(Array.from(savedIds)));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }, [savedIds]);

  // Load Categories List
  const loadCategories = useCallback(async () => {
    try {
      const res = await fetchCategories();
      setCategories(res.categories || []);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Load Category Details & Breadcrumbs when selected
  useEffect(() => {
    if (!selectedCategorySlug) {
      setCurrentCategoryData(null);
      setBreadcrumbs([]);
      return;
    }

    fetchCategory(selectedCategorySlug)
      .then((res) => {
        setCurrentCategoryData(res.category);
        setBreadcrumbs(res.breadcrumbs || []);
      })
      .catch((err) => console.error('Error fetching category:', err));
  }, [selectedCategorySlug]);

  // Load Resources whenever filters or pagination change
  const loadResources = useCallback(async () => {
    setLoading(true);
    try {
      const effectiveSearch = globalSearch || search;
      const res = await fetchResources({
        category: selectedCategorySlug || 'all',
        search: effectiveSearch,
        pricing,
        status,
        sort,
        page: pagination.page,
        limit: 25,
      });

      setResources(res.resources || []);
      setPagination(res.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to fetch resources:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategorySlug, search, globalSearch, pricing, status, sort, pagination.page]);

  useEffect(() => {
    if (activeView === 'directory') {
      loadResources();
    }
  }, [loadResources, activeView]);

  // Handle Category Selection
  const handleSelectCategory = (slug) => {
    setSelectedCategorySlug(slug);
    setPagination((prev) => ({ ...prev, page: 1 }));
    setSearch('');
    if (activeView !== 'directory') setActiveView('directory');
  };

  // Handle Bookmark
  const handleBookmark = async (id) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    try {
      await bookmarkResource(id);
    } catch (err) {
      console.warn('Bookmark sync notice:', err);
    }
  };

  // Trigger Category Update (supports 100, 250, 500, 1000 tools)
  const handleTriggerCategoryUpdate = async (slug, targetCount = 100) => {
    if (!slug) return;
    setIsUpdatingCategory(true);
    try {
      const res = await triggerCategoryUpdate(slug, targetCount);
      setActiveJobId(res.jobId);
    } catch (err) {
      alert(`Update Notice: ${err.message}`);
    } finally {
      setIsUpdatingCategory(false);
    }
  };

  // Handle Confirmed Category Deletion
  const handleConfirmDeleteCategory = async (slug) => {
    try {
      await deleteCategory(slug);
      await loadCategories();
      if (selectedCategorySlug === slug) {
        setSelectedCategorySlug(null);
      }
      await loadResources();
    } catch (err) {
      alert(`Deletion Failed: ${err.message}`);
      throw err;
    }
  };

  // Trigger Global Discovery
  const handleTriggerGlobalDiscovery = async () => {
    try {
      const res = await triggerGlobalDiscovery();
      setActiveJobId(res.jobId);
    } catch (err) {
      alert(`Global Discovery Notice: ${err.message}`);
    }
  };

  // Callback when an update job finishes cleanly
  const handleJobComplete = () => {
    loadCategories();
    loadResources();
  };

  // Filter bookmarked resources for saved view
  const savedResourcesList = resources.filter((r) => savedIds.has(r._id));

  return (
    <div className="min-h-screen bg-background text-gray-200 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Header */}
      <Header
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenAddCategory={() => setAddCategoryOpen(true)}
        onOpenGlobalDiscovery={handleTriggerGlobalDiscovery}
        savedCount={savedIds.size}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        globalSearch={globalSearch}
        setGlobalSearch={setGlobalSearch}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Hierarchical Sidebar */}
        {activeView === 'directory' && (
          <Sidebar
            categories={categories}
            selectedCategory={selectedCategorySlug}
            onSelectCategory={handleSelectCategory}
            totalToolsCount={pagination.total}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            onOpenDeleteCategory={(cat) => setCategoryToDelete(cat)}
          />
        )}

        {/* Main Workspace Area */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          {activeView === 'directory' && (
            <div>
              {/* Breadcrumb Navigation */}
              <Breadcrumb
                breadcrumbs={breadcrumbs}
                onSelectCategory={handleSelectCategory}
              />

              {/* Category Header with 100+ Tools Target & Delete Controls */}
              <CategoryHeader
                category={currentCategoryData}
                totalCount={pagination.total}
                onTriggerUpdate={handleTriggerCategoryUpdate}
                isUpdating={isUpdatingCategory}
                onOpenDeleteCategory={(cat) => setCategoryToDelete(cat)}
              />

              {/* Filters & Sorting */}
              <FilterBar
                search={search}
                setSearch={(val) => {
                  setSearch(val);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                pricing={pricing}
                setPricing={(val) => {
                  setPricing(val);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                status={status}
                setStatus={(val) => {
                  setStatus(val);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                sort={sort}
                setSort={(val) => {
                  setSort(val);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                pagination={pagination}
                onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
              />

              {/* The Directory Table */}
              <DirectoryTable
                resources={resources}
                loading={loading}
                sort={sort}
                onSortChange={(col) => setSort(col)}
                onSelectResource={(item) => setSelectedTool(item)}
                onBookmark={handleBookmark}
                savedResourceIds={savedIds}
              />

              {/* Bottom Pagination Bar */}
              {pagination.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between text-xs text-gray-400 border-t border-border/80 pt-3">
                  <span>
                    Showing {resources.length} of {pagination.total} verified tools
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                      disabled={pagination.page <= 1}
                      className="rounded-lg border border-border bg-surface px-3 py-1.5 hover:bg-surface-elevated disabled:opacity-30"
                    >
                      Previous
                    </button>
                    <span className="font-mono text-gray-300">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <button
                      onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                      disabled={!pagination.hasMore}
                      className="rounded-lg border border-border bg-surface px-3 py-1.5 hover:bg-surface-elevated disabled:opacity-30"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeView === 'saved' && (
            <SavedView
              savedResources={savedResourcesList}
              onSelectResource={(item) => setSelectedTool(item)}
              onRemoveBookmark={handleBookmark}
              onBackToDirectory={() => setActiveView('directory')}
            />
          )}

          {activeView === 'admin' && (
            <AdminView
              onOpenGlobalDiscovery={handleTriggerGlobalDiscovery}
            />
          )}
        </main>
      </div>

      {/* Live Background Job Progress Drawer */}
      {activeJobId && (
        <JobProgressDrawer
          jobId={activeJobId}
          onClose={() => setActiveJobId(null)}
          onJobComplete={handleJobComplete}
        />
      )}

      {/* Add Category Modal with AI Taxonomy Evaluation */}
      <AddCategoryModal
        isOpen={addCategoryOpen}
        onClose={() => setAddCategoryOpen(false)}
        onCategoryCreated={(newCat, job) => {
          loadCategories();
          if (newCat?.slug) {
            handleSelectCategory(newCat.slug);
          }
          if (job?.jobId) {
            setActiveJobId(job.jobId);
          }
        }}
      />

      {/* Tool Inspection & Verification Details Modal */}
      {selectedTool && (
        <ToolDetailModal
          resource={selectedTool}
          onClose={() => setSelectedTool(null)}
          onBookmark={handleBookmark}
          isSaved={savedIds.has(selectedTool._id)}
          onResourceUpdated={loadResources}
        />
      )}

      {/* Delete Category Confirmation Modal */}
      <DeleteCategoryModal
        isOpen={Boolean(categoryToDelete)}
        category={categoryToDelete}
        onClose={() => setCategoryToDelete(null)}
        onConfirmDelete={handleConfirmDeleteCategory}
      />
    </div>
  );
}

