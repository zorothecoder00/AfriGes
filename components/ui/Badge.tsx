"use client";

import type { ReactNode } from "react";

// success/error/warning/info/neutral = variants sémantiques (statuts).
// purple/teal/indigo = catégories métier non sémantiques (ex: type de client
// FAMILIAL/REVENDEUR, nature d'opération REMBOURSEMENT/ÉPARGNE, badge RIA...).
export type BadgeVariant = "success" | "error" | "warning" | "info" | "neutral" | "purple" | "teal" | "indigo";
type Variant = BadgeVariant;

const VARIANT_CLASSES: Record<Variant, string> = {
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  error:   "bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  info:    "bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300",
  neutral: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  purple:  "bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  teal:    "bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  indigo:  "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
};

const BORDER_CLASSES: Record<Variant, string> = {
  success: "border-emerald-200 dark:border-emerald-800",
  error:   "border-red-200 dark:border-red-800",
  warning: "border-amber-200 dark:border-amber-800",
  info:    "border-primary-200 dark:border-primary-800",
  neutral: "border-slate-200 dark:border-slate-600",
  purple:  "border-purple-200 dark:border-purple-800",
  teal:    "border-teal-200 dark:border-teal-800",
  indigo:  "border-indigo-200 dark:border-indigo-800",
};

export default function Badge({
  variant = "neutral",
  icon,
  bordered = false,
  children,
  className = "",
}: {
  variant?: Variant;
  icon?: ReactNode;
  /** Ajoute une bordure de la même teinte (certaines pages en avaient une, d'autres non). */
  bordered?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium whitespace-nowrap
        ${VARIANT_CLASSES[variant]} ${bordered ? `border ${BORDER_CLASSES[variant]}` : ""} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}
