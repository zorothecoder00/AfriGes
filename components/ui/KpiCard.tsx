"use client";

import type { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import InfoTooltip from "@/components/ui/InfoTooltip";

type Accent = "primary" | "success" | "warning" | "error" | "brand" | "neutral" | "purple" | "teal";

const ACCENT_CLASSES: Record<Accent, {
  bg: string; text: string; hoverBorder: string; hoverShadow: string;
  gradient: string; border: string; accentBar: string; valueText: string; labelText: string;
}> = {
  primary: { bg: "bg-primary-100 dark:bg-primary-900/30", text: "text-primary-600 dark:text-primary-300", hoverBorder: "hover:border-primary-300", hoverShadow: "hover:shadow-primary-200/60", gradient: "from-primary-50 dark:from-primary-950/40", border: "border-primary-100 dark:border-primary-800/50", accentBar: "bg-primary-500", valueText: "text-primary-700 dark:text-primary-300", labelText: "text-primary-700/80 dark:text-primary-300/80" },
  success: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-300", hoverBorder: "hover:border-emerald-300", hoverShadow: "hover:shadow-emerald-200/60", gradient: "from-emerald-50 dark:from-emerald-950/40", border: "border-emerald-100 dark:border-emerald-800/50", accentBar: "bg-emerald-500", valueText: "text-emerald-700 dark:text-emerald-300", labelText: "text-emerald-700/80 dark:text-emerald-300/80" },
  warning: { bg: "bg-amber-100 dark:bg-amber-900/30",   text: "text-amber-600 dark:text-amber-300",   hoverBorder: "hover:border-amber-300",   hoverShadow: "hover:shadow-amber-200/60",   gradient: "from-amber-50 dark:from-amber-950/40",   border: "border-amber-100 dark:border-amber-800/50",   accentBar: "bg-amber-500",   valueText: "text-amber-700 dark:text-amber-300",   labelText: "text-amber-700/80 dark:text-amber-300/80" },
  error:   { bg: "bg-red-100 dark:bg-red-900/30",       text: "text-red-600 dark:text-red-300",       hoverBorder: "hover:border-red-300",     hoverShadow: "hover:shadow-red-200/60",     gradient: "from-red-50 dark:from-red-950/40",       border: "border-red-100 dark:border-red-800/50",       accentBar: "bg-red-500",     valueText: "text-red-700 dark:text-red-300",       labelText: "text-red-700/80 dark:text-red-300/80" },
  brand:   { bg: "bg-brand-100 dark:bg-brand-900/30",   text: "text-brand-700 dark:text-brand-300",   hoverBorder: "hover:border-brand-300",   hoverShadow: "hover:shadow-brand-200/60",   gradient: "from-brand-50 dark:from-brand-950/40",   border: "border-brand-100 dark:border-brand-800/50",   accentBar: "bg-brand-500",   valueText: "text-brand-700 dark:text-brand-300",   labelText: "text-brand-700/80 dark:text-brand-300/80" },
  neutral: { bg: "bg-slate-200 dark:bg-slate-700",     text: "text-slate-600 dark:text-slate-300",   hoverBorder: "hover:border-slate-400",   hoverShadow: "hover:shadow-slate-300/60",   gradient: "from-slate-100 dark:from-slate-800",     border: "border-slate-200 dark:border-slate-700",     accentBar: "bg-slate-400",   valueText: "text-slate-700 dark:text-slate-200",   labelText: "text-slate-600/90 dark:text-slate-300/80" },
  purple:  { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-600 dark:text-purple-300", hoverBorder: "hover:border-purple-300",  hoverShadow: "hover:shadow-purple-200/60",  gradient: "from-purple-50 dark:from-purple-950/40", border: "border-purple-100 dark:border-purple-800/50", accentBar: "bg-purple-500",  valueText: "text-purple-700 dark:text-purple-300", labelText: "text-purple-700/80 dark:text-purple-300/80" },
  teal:    { bg: "bg-teal-100 dark:bg-teal-900/30",     text: "text-teal-600 dark:text-teal-300",     hoverBorder: "hover:border-teal-300",    hoverShadow: "hover:shadow-teal-200/60",    gradient: "from-teal-50 dark:from-teal-950/40",     border: "border-teal-100 dark:border-teal-800/50",     accentBar: "bg-teal-500",    valueText: "text-teal-700 dark:text-teal-300",     labelText: "text-teal-700/80 dark:text-teal-300/80" },
};

// Variante « solid » (défaut) : fond plein soutenu et texte blanc, pour ressortir sur le
// fond bleu clair des pages. « soft » : ancien dégradé clair, toujours disponible.
const SOLID_CLASSES: Record<Accent, string> = {
  primary: "bg-primary-700 border-primary-800 hover:shadow-primary-300/60",
  success: "bg-emerald-700 border-emerald-800 hover:shadow-emerald-300/60",
  warning: "bg-amber-600 border-amber-700 hover:shadow-amber-300/60",
  error:   "bg-red-700 border-red-800 hover:shadow-red-300/60",
  brand:   "bg-brand-700 border-brand-800 hover:shadow-brand-300/60",
  neutral: "bg-slate-700 border-slate-800 hover:shadow-slate-300/60",
  purple:  "bg-purple-700 border-purple-800 hover:shadow-purple-300/60",
  teal:    "bg-teal-700 border-teal-800 hover:shadow-teal-300/60",
};

export default function KpiCard({
  label,
  value,
  format,
  icon,
  accent = "primary",
  evolutionPct,
  help,
  sub,
  variant = "solid",
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
  /** Ligne secondaire sous le libellé (détail complémentaire, ex: "8 total · 2 bloqué(s)"). */
  sub?: string;
  /** "solid" (défaut) : fond plein soutenu, texte blanc ; "soft" : dégradé clair. */
  variant?: "soft" | "solid";
  className?: string;
}) {
  const c = ACCENT_CLASSES[accent];
  const solid = variant === "solid";
  const hasEvolution = evolutionPct !== undefined && !Number.isNaN(evolutionPct);
  const positif = (evolutionPct ?? 0) >= 0;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border shadow-sm p-4 sm:p-5 min-w-0
        transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl ${
          solid ? SOLID_CLASSES[accent] : `bg-gradient-to-br ${c.gradient} to-white dark:to-slate-900 ${c.border} ${c.hoverShadow} ${c.hoverBorder}`
        } ${className}`}
    >
      {!solid && <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${c.accentBar}`} />}
      <div className="flex items-start justify-between gap-2">
        <div className={`shrink-0 p-2.5 rounded-xl ${solid ? "bg-white/20" : c.bg} transition-transform duration-300 ease-out group-hover:scale-110`}>
          <span className={solid ? "text-white" : c.text}>{icon}</span>
        </div>
        {hasEvolution && (
          <span
            className={`shrink-0 inline-flex items-center gap-1 text-xs font-medium rounded-lg px-2 py-0.5
              ${solid ? "bg-white/90 " + (positif ? "text-emerald-700" : "text-red-700")
                : positif ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"}`}
          >
            {positif ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(evolutionPct as number)}%
          </span>
        )}
      </div>
      <p className={`text-xl sm:text-2xl leading-tight [overflow-wrap:anywhere] font-bold mt-3 transition-transform duration-300 group-hover:scale-105 origin-left ${solid ? "text-white" : c.valueText}`}>
        <AnimatedNumber value={value} format={format} />
      </p>
      <p className={`text-xs font-medium mt-1 ${solid ? "text-white/85" : c.labelText}`}>
        {label}
        {help && <InfoTooltip text={help} />}
      </p>
      {sub && <p className={`text-xs mt-0.5 truncate ${solid ? "text-white/70" : "text-slate-400 dark:text-slate-500"}`}>{sub}</p>}
    </div>
  );
}
