"use client";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Libellé de l'unité comptée (ex: "clients", "crédits"). */
  itemLabel?: string;
}

export default function Pagination({ page, totalPages, total, onPageChange, itemLabel }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Page <b>{page}</b> / <b>{totalPages}</b>
        {itemLabel && ` (${total} ${itemLabel})`}
      </p>
      <div className="flex items-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Précédent
        </button>
        <span className="px-4 py-2 bg-primary-600 text-white rounded-xl font-medium">{page}</span>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Suivant
        </button>
      </div>
    </div>
  );
}
