"use client";

import type { ReactNode } from "react";

type Variant = "success" | "error" | "warning" | "info" | "neutral";

const VARIANT_CLASSES: Record<Variant, string> = {
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  error:   "bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  info:    "bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300",
  neutral: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

export default function Badge({
  variant = "neutral",
  icon,
  children,
  className = "",
}: {
  variant?: Variant;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium whitespace-nowrap
        ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}
