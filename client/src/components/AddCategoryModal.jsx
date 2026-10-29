import React, { useState } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FolderPlus,
  ArrowRight,
  Search,
  Bot,
} from 'lucide-react';
import { evaluateCategory, createCategory } from '../services/api';

export default function AddCategoryModal({
  isOpen,
  onClose,
  onCategoryCreated,
}) {
  const [name, setName] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [fetchImmediately, setFetchImmediately] = useState(true);

  if (!isOpen) return null;

  const handleEvaluate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setEvaluating(true);
    setError('');
    setEvaluation(null);

    try {
      const res = await evaluateCategory(name.trim());
      setEvaluation(res.evaluation);
    } catch (err) {
      setError(err.message || 'Failed to evaluate category');
    } finally {
      setEvaluating(false);
    }
  };

  const handleConfirmCreate = async () => {
    if (!evaluation || !evaluation.proposedCategory) return;

    setCreating(true);
    setError('');

    try {
      const res = await createCategory({
        name: evaluation.proposedCategory.name,
        parentSlug: evaluation.proposedCategory.parentSlug,
        description: evaluation.proposedCategory.description,
        synonyms: evaluation.proposedCategory.synonyms || [],
        icon: evaluation.proposedCategory.icon || 'Sparkles',
        fetchWebsitesImmediately: fetchImmediately,
      });

      onCategoryCreated(res.category, res.discoveryJob);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create category');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
              <FolderPlus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Add New Category</h2>
              <p className="text-[11px] text-gray-400">Expand the directory hierarchy dynamically with AI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-surface-elevated hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleEvaluate} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Category Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. AI Resume Builders, Robotics Simulation, Vibe Coding..."
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
                autoFocus
              />
              <button
                type="submit"
                disabled={evaluating || !name.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors shadow-sm"
              >
                <Bot className={`h-3.5 w-3.5 ${evaluating ? 'animate-spin' : ''}`} />
                <span>{evaluating ? 'Analyzing...' : 'Evaluate'}</span>
              </button>
            </div>
          </div>
        </form>

        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Gemini Evaluation Insight */}
        {evaluation && (
          <div className="rounded-xl border border-border bg-surface-elevated/80 p-4 space-y-3 text-xs">
            {evaluation.isDuplicate ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Synonym / Equivalent Category Exists</span>
                </div>
                <p className="text-gray-300 text-xs">
                  {evaluation.clarificationNote}
                </p>
                <div className="p-2.5 rounded-lg bg-background border border-border/80 text-[11px] text-gray-400 flex items-center justify-between">
                  <span>Existing Target: <strong>{evaluation.proposedCategory?.name || evaluation.matchedExistingSlug}</strong></span>
                  <button
                    onClick={() => {
                      onCategoryCreated(evaluation.proposedCategory);
                      onClose();
                    }}
                    className="text-indigo-400 hover:text-indigo-300 underline font-medium"
                  >
                    View Existing Category
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>New Distinct Category Validated</span>
                </div>
                <p className="text-gray-300 text-xs">
                  {evaluation.clarificationNote}
                </p>

                <div className="rounded-lg bg-background border border-border/80 p-3 space-y-2 font-mono text-[11px]">
                  <div>
                    <span className="text-gray-500">Name:</span> <span className="text-white font-semibold">{evaluation.proposedCategory?.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Parent:</span> <span className="text-cyan-400">{evaluation.proposedCategory?.parentSlug || 'Top Level'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Scope:</span> <span className="text-gray-300">{evaluation.proposedCategory?.description}</span>
                  </div>
                  {evaluation.proposedCategory?.synonyms?.length > 0 && (
                    <div>
                      <span className="text-gray-500">Synonyms:</span>{' '}
                      <span className="text-gray-400">{evaluation.proposedCategory.synonyms.join(', ')}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="fetchNow"
                    checked={fetchImmediately}
                    onChange={(e) => setFetchImmediately(e.target.checked)}
                    className="rounded border-border bg-background text-indigo-600 focus:ring-0"
                  />
                  <label htmlFor="fetchNow" className="text-xs text-gray-300 select-none cursor-pointer flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                    <span><strong>Fetch Websites with AI</strong> immediately after creating</span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                  <button
                    onClick={onClose}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-surface"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmCreate}
                    disabled={creating}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-600/20"
                  >
                    <span>{creating ? 'Creating...' : 'Confirm & Save Category'}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

