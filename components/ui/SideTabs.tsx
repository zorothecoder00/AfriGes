"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type SideTabItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  href?: string;        // route-based : rendu en <Link>
  onClick?: () => void; // state-based : rendu en <button>
  active: boolean;
};

const ACCENTS = {
  blue:    { text: "text-primary-700", border: "border-primary-600", bg: "bg-primary-50/50" },
  emerald: { text: "text-emerald-700", border: "border-emerald-600", bg: "bg-emerald-50/50" },
  indigo:  { text: "text-indigo-700",  border: "border-indigo-600", bg: "bg-indigo-50/50" },
  violet:  { text: "text-violet-700",  border: "border-violet-600", bg: "bg-violet-50/50" },
  red:     { text: "text-red-700",     border: "border-red-600",    bg: "bg-red-50/50" },
  amber:   { text: "text-amber-700",   border: "border-amber-600",  bg: "bg-amber-50/50" },
} as const;

export type SideTabsAccent = keyof typeof ACCENTS;

export default function SideTabs({
  items,
  accent = "blue",
  className = "",
}: {
  items: SideTabItem[];
  accent?: SideTabsAccent;
  className?: string;
}) {
  const c = ACCENTS[accent];

  return (
    <nav
      className={`flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible
        border-b md:border-b-0 md:border-r border-gray-200
        md:w-56 md:shrink-0 pb-1 md:pb-0 md:pr-3 scrollbar-hide ${className}`}
    >
      {items.map((item) => {
        const cls = `flex items-center gap-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors rounded-md
          border-b-2 md:border-b-0 md:border-l-2
          ${item.active
            ? `${c.border} ${c.text} ${c.bg}`
            : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"}`;

        return item.href ? (
          <Link key={item.key} href={item.href} className={cls}>
            {item.icon}
            {item.label}
          </Link>
        ) : (
          <button key={item.key} type="button" onClick={item.onClick} className={cls}>
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
