import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, ShieldCheck } from 'lucide-react';

export default function DeleteCategoryModal({
  isOpen,
  category,
  onClose,
  onConfirmDelete,
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !category) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      await onConfirmDelete(category.slug);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to delete category');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-surface p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <div className="flex items-center gap-2.5 text-rose-400">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/30">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Delete Category</h2>
              <p className="text-[11px] text-gray-400">Confirm taxonomy removal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-surface-elevated hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3 text-xs text-gray-300">
          <p>
            Are you sure you want to delete the category{' '}
            <strong className="text-white bg-surface-elevated px-2 py-0.5 rounded border border-border">
              {category.name}
            </strong>
            ?
          </p>

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-1.5 text-emerald-300">
            <div className="flex items-center gap-1.5 font-semibold text-xs">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Zero-Deletion Guarantee Active</span>
            </div>
            <p className="text-[11px] text-gray-300 leading-relaxed">
              All tools and websites currently indexed in this category will remain permanently preserved in MongoDB.
              They will stay accessible through global search, other assigned categories, and the master repository.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-rose-300">
              {error}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/70">
          <button
            onClick={onClose}
            disabled={deleting}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-surface-elevated transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50 transition-colors shadow-lg shadow-rose-600/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{deleting ? 'Deleting Category...' : 'Yes, Delete Category'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

