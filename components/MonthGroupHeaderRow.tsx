"use client";

// components/MonthGroupHeaderRow.tsx
// En-tête de mois pliable pour les tableaux regroupés par mois (crédits,
// remboursements, encaissements). À insérer comme <tr> dans un <tbody>.

import { useCallback, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/format";

/**
 * Hook d'état de pliage des groupes mensuels.
 * Tous les mois sont dépliés par défaut ; on stocke uniquement les clés repliées.
 */
export function useCollapsedMonths() {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const isOpen = useCallback((key: string) => !collapsed.has(key), [collapsed]);
  const toggle = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  return { isOpen, toggle };
}

export function MonthGroupHeaderRow({
  label,
  total,
  count,
  colSpan,
  open,
  onToggle,
  showTotal = true,
}: {
  label: string;
  total?: number;
  count?: number;
  colSpan: number;
  open: boolean;
  onToggle: () => void;
  showTotal?: boolean;
}) {
  return (
    <tr
      className="bg-slate-100/70 border-y border-slate-200 cursor-pointer select-none hover:bg-slate-100 transition-colors"
      onClick={onToggle}
    >
      <td colSpan={colSpan} className="px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 font-semibold text-slate-700 text-sm capitalize">
            {open ? <ChevronDown size={15} className="text-slate-500" /> : <ChevronRight size={15} className="text-slate-500" />}
            {label}
            {typeof count === "number" && (
              <span className="text-xs font-normal text-slate-400">· {count}</span>
            )}
          </span>
          {showTotal && typeof total === "number" && (
            <span className="font-bold text-emerald-700 text-sm">{formatCurrency(total)}</span>
          )}
        </div>
      </td>
    </tr>
  );
}
