"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

export type SideTabItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  href?: string;        // route-based : rendu en <Link>
  onClick?: () => void; // state-based : rendu en <button>
  active: boolean;
};

// Même traitement visuel que AdminSidebar : conteneur en fond plein coloré,
// items inactifs en texte clair, item actif en pastille blanche.
const ACCENTS = {
  blue:    { containerBg: "bg-primary-700", containerBorder: "border-primary-800", inactiveText: "text-primary-50/90", inactiveHover: "hover:bg-primary-600/60 hover:text-white", activeText: "text-primary-800" },
  brand:   { containerBg: "bg-brand-700",   containerBorder: "border-brand-800",   inactiveText: "text-brand-50/90",   inactiveHover: "hover:bg-brand-600/60 hover:text-white",   activeText: "text-brand-800" },
  emerald: { containerBg: "bg-emerald-700", containerBorder: "border-emerald-800", inactiveText: "text-emerald-50/90", inactiveHover: "hover:bg-emerald-600/60 hover:text-white", activeText: "text-emerald-800" },
  indigo:  { containerBg: "bg-indigo-700",  containerBorder: "border-indigo-800",  inactiveText: "text-indigo-50/90",  inactiveHover: "hover:bg-indigo-600/60 hover:text-white",  activeText: "text-indigo-800" },
  violet:  { containerBg: "bg-violet-700",  containerBorder: "border-violet-800",  inactiveText: "text-violet-50/90",  inactiveHover: "hover:bg-violet-600/60 hover:text-white",  activeText: "text-violet-800" },
  red:     { containerBg: "bg-red-700",     containerBorder: "border-red-800",     inactiveText: "text-red-50/90",     inactiveHover: "hover:bg-red-600/60 hover:text-white",     activeText: "text-red-800" },
  amber:   { containerBg: "bg-amber-700",   containerBorder: "border-amber-800",   inactiveText: "text-amber-50/90",   inactiveHover: "hover:bg-amber-600/60 hover:text-white",   activeText: "text-amber-800" },
} as const;

export type SideTabsAccent = keyof typeof ACCENTS;

const COLLAPSE_STORAGE_KEY = "sidetabs-collapsed";

export default function SideTabs({
  items,
  accent = "blue",
  className = "",
  expandedWidthClass = "md:w-44",
}: {
  items: SideTabItem[];
  accent?: SideTabsAccent;
  className?: string;
  /** Largeur (classe Tailwind) de la colonne dépliée — par défaut md:w-44. */
  expandedWidthClass?: string;
}) {
  const c = ACCENTS[accent];

  // Repli/dépli de la colonne d'onglets (desktop uniquement) — préférence mémorisée.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1") setCollapsed(true);
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  // Peu d'onglets (ex. Ventes directes / Livraisons packs) → une grande colonne
  // verticale colorée est disproportionnée. On bascule alors sur des pilules
  // horizontales compactes, sans bouton collapse (déjà minimal) ni contrainte
  // de largeur.
  if (items.length <= 3) {
    return (
      <div className={`inline-flex flex-wrap gap-1 self-start w-fit rounded-xl border ${c.containerBg} ${c.containerBorder} shadow-sm p-1.5 ${className}`}>
        {items.map((item) => {
          const cls = `flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-lg
            ${item.active ? `bg-white shadow-sm ${c.activeText}` : `${c.inactiveText} ${c.inactiveHover}`}`;
          const content = <>{item.icon}{item.label}</>;

          return item.href ? (
            <Link key={item.key} href={item.href} className={cls}>{content}</Link>
          ) : (
            <button key={item.key} type="button" onClick={item.onClick} className={cls}>{content}</button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`md:shrink-0 ${collapsed ? "md:w-12" : expandedWidthClass} transition-[width] duration-200 ${className}`}>
      <div className={`rounded-2xl border ${c.containerBg} ${c.containerBorder} shadow-sm p-2`}>
        {/* Bouton collapse/expand — desktop uniquement */}
        <div className={`hidden md:flex mb-1 ${collapsed ? "justify-center" : "justify-end"}`}>
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? "Déplier les onglets" : "Replier les onglets"}
            className={`p-1 rounded-md ${c.inactiveText} ${c.inactiveHover} transition-colors`}
          >
            {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
          </button>
        </div>

        <nav
          className={`flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible scrollbar-hide`}
        >
          {items.map((item) => {
            const cls = `flex items-center gap-1.5 px-2.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors rounded-xl
              ${collapsed ? "md:justify-center md:px-2" : ""}
              ${item.active
                ? `bg-white shadow-sm ${c.activeText}`
                : `${c.inactiveText} ${c.inactiveHover}`}`;

            const content = (
              <>
                {item.icon}
                <span className={collapsed ? "md:hidden" : ""}>{item.label}</span>
              </>
            );

            return item.href ? (
              <Link key={item.key} href={item.href} className={cls} title={collapsed ? item.label : undefined}>
                {content}
              </Link>
            ) : (
              <button key={item.key} type="button" onClick={item.onClick} className={cls} title={collapsed ? item.label : undefined}>
                {content}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
