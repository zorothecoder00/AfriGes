"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Wallet, Briefcase, Home, ChevronRight,
  UserCheck, Activity, TrendingDown, ArrowUpCircle, Star, Award,
  DollarSign, BarChart2, FileText, Settings, BookOpen,
} from "lucide-react";

const NAV = [
  { href: "/dashboard/user/responsablesRIA",                        label: "Dashboard",     icon: LayoutDashboard, exact: true },
  { href: "/dashboard/user/responsablesRIA/investisseurs",          label: "Investisseurs", icon: Users },
  { href: "/dashboard/user/responsablesRIA/portefeuilles",          label: "Portefeuilles", icon: Briefcase },
  { href: "/dashboard/user/responsablesRIA/fonds",                  label: "Fonds",         icon: Wallet },
  { href: "/dashboard/user/responsablesRIA/financements",           label: "Financements",  icon: Activity },
  { href: "/dashboard/user/responsablesRIA/recouvrement",           label: "Recouvrement",  icon: TrendingDown },
  { href: "/dashboard/user/responsablesRIA/affectations",           label: "Affectations",  icon: UserCheck },
  { href: "/dashboard/user/responsablesRIA/distributions",          label: "Distributions", icon: ArrowUpCircle },
  { href: "/dashboard/user/responsablesRIA/scoring",                label: "Scoring",       icon: Star },
  { href: "/dashboard/user/responsablesRIA/commissions",            label: "Commissions",   icon: Award },
  { href: "/dashboard/user/responsablesRIA/benefices",              label: "Bénéfices",     icon: DollarSign },
  { href: "/dashboard/user/responsablesRIA/bi",                     label: "BI",            icon: BarChart2 },
  { href: "/dashboard/user/responsablesRIA/rapports",               label: "Rapports",      icon: FileText },
  { href: "/dashboard/user/responsablesRIA/comptabilite",           label: "Comptabilité",  icon: BookOpen },
  { href: "/dashboard/user/responsablesRIA/config",                 label: "Config",        icon: Settings },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export default function ResponsableRIALayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="px-6 pt-3 flex items-center gap-1.5 text-xs text-slate-400">
          <Link href="/dashboard/user" className="flex items-center gap-1 hover:text-slate-600 transition-colors">
            <Home className="w-3 h-3" /> Accueil
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-emerald-600 font-medium">RIA — Réseau des Investisseurs AfriSime</span>
        </div>
        <nav className="px-6 flex items-end gap-0.5 overflow-x-auto">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact);
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  active
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
