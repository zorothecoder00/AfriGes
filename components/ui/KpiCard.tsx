"use client";

import type { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import InfoTooltip from "@/components/ui/InfoTooltip";

type Accent = "primary" | "success" | "warning" | "error" | "brand" | "neutral";

const ACCENT_CLASSES: Record<Accent, { bg: string; text: string }> = {
  primary: { bg: "bg-primary-50 dark:bg-primary-900/30", text: "text-primary-600 dark:text-primary-300" },
  success: { bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-300" },
  warning: { bg: "bg-amber-50 dark:bg-amber-900/30",   text: "text-amber-600 dark:text-amber-300" },
  error:   { bg: "bg-red-50 dark:bg-red-900/30",       text: "text-red-600 dark:text-red-300" },
  brand:   { bg: "bg-brand-50 dark:bg-brand-900/30",   text: "text-brand-700 dark:text-brand-300" },
  neutral: { bg: "bg-slate-100 dark:bg-slate-700",     text: "text-slate-600 dark:text-slate-300" },
};

export default function KpiCard({
  label,
  value,
  format,
  icon,
  accent = "primary",
  evolutionPct,
  help,
  className = "",
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
  icon: ReactNode;
  accent?: Accent;
  /** Évolution en % — positif = hausse (vert), négatif = baisse (rouge). */
  evolutionPct?: number;
  /** Texte d'aide affiché dans une info-bulle à côté du libellé. */
  help?: string;
  className?: string;
}) {
  const c = ACCENT_CLASSES[accent];
  const hasEvolution = evolutionPct !== undefined && !Number.isNaN(evolutionPct);
  const positif = (evolutionPct ?? 0) >= 0;

  return (
    <div
      className={`rounded-2xl bg-white border border-slate-200 shadow-sm p-5
        transition-shadow hover:shadow-md dark:bg-slate-800 dark:border-slate-700 ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl ${c.bg}`}>
          <span className={c.text}>{icon}</span>
        </div>
        {hasEvolution && (
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium rounded-lg px-2 py-0.5
              ${positif ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300"}`}
          >
            {positif ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(evolutionPct as number)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 mt-3">
        <AnimatedNumber value={value} format={format} />
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
        {label}
        {help && <InfoTooltip text={help} />}
      </p>
    </div>
  );
}
