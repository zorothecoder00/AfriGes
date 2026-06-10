"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Wallet, Activity,
  UserCheck, DollarSign, Settings, ChevronRight, Home,
} from "lucide-react";

// ── Navigation RIA ────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: "/dashboard/admin/ria",              label: "Dashboard",       icon: LayoutDashboard, exact: true },
  { href: "/dashboard/admin/ria/investisseurs", label: "Investisseurs",  icon: Users },
  { href: "/dashboard/admin/ria/fonds",         label: "Fonds",          icon: Wallet },
  { href: "/dashboard/admin/ria/financements",  label: "Financements",   icon: Activity },
  { href: "/dashboard/admin/ria/affectations",  label: "Affectations",   icon: UserCheck },
  { href: "/dashboard/admin/ria/distributions", label: "Distributions",  icon: DollarSign },
  { href: "/dashboard/admin/ria/config",        label: "Configuration",  icon: Settings },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function RIALayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Barre de navigation RIA ── */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        {/* Breadcrumb */}
        <div className="px-6 pt-3 flex items-center gap-1.5 text-xs text-slate-400">
          <Link href="/dashboard/admin" className="flex items-center gap-1 hover:text-slate-600 transition-colors">
            <Home className="w-3 h-3" /> Admin
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-emerald-600 font-medium">RIA — Réseau des Investisseurs AfriSime</span>
        </div>

        {/* Onglets */}
        <nav className="px-6 flex items-end gap-0.5 overflow-x-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  active
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ── Contenu ── */}
      {children}
    </div>
  );
}
