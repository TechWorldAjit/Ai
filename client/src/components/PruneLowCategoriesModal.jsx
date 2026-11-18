import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, ShieldCheck } from 'lucide-react';

export default function PruneLowCategoriesModal({
  isOpen,
  onClose,
  onConfirmPrune,
}) {
  const [pruning, setPruning] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handlePrune = async () => {
    setPruning(true);
    setError('');
    try {
      await onConfirmPrune();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to delete categories');
    } finally {
      setPruning(false);
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
              <h2 className="text-sm font-bold text-white">Delete Categories with &lt; 5 Entries</h2>
              <p className="text-[11px] text-gray-400">Master taxonomy cleanup</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={pruning}
            className="rounded-lg p-1 text-gray-400 hover:bg-surface-elevated hover:text-white disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3 text-xs text-gray-300">
          <p>
            Are you sure you want to delete all categories and subcategories with{' '}
            <strong className="text-rose-300 font-semibold">fewer than 5 entries</strong>?
          </p>

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-1.5 text-emerald-300">
            <div className="flex items-center gap-1.5 font-semibold text-[11px] text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              <span>Zero-Deletion Guarantee</span>
            </div>
            <p className="text-[11px] text-emerald-200/90 leading-relaxed">
              Every website, tool, and resource will remain permanently preserved in MongoDB.
              Only empty or low-density category definitions are safely unlinked.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-500/50 bg-rose-500/10 p-2.5 text-rose-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 border-t border-border/80 pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={pruning}
            className="rounded-xl border border-border px-4 py-2 text-xs font-medium text-gray-400 hover:bg-surface-elevated hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePrune}
            disabled={pruning}
            className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-rose-600/30 hover:bg-rose-500 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{pruning ? 'Deleting Categories...' : 'Confirm Delete (< 5 Entries)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
