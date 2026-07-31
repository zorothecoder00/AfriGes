"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import AfriSimeLogo from "@/components/AfriSimeLogo";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Wallet, Briefcase, Home,
  UserCheck, Activity, TrendingDown, ArrowUpCircle, Star, Award,
  DollarSign, BarChart2, FileText, Settings, BookOpen, AlertTriangle, FolderOpen, Shield,
  Menu, X,
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
  { href: "/dashboard/user/responsablesRIA/commissions",            label: "Rémunérations agents", icon: Award },
  { href: "/dashboard/user/responsablesRIA/gouvernance",            label: "Gouvernance",   icon: Shield },
  { href: "/dashboard/user/responsablesRIA/benefices",              label: "Bénéfices",     icon: DollarSign },
  { href: "/dashboard/user/responsablesRIA/bi",                     label: "BI",            icon: BarChart2 },
  { href: "/dashboard/user/responsablesRIA/rapports",               label: "Rapports",      icon: FileText },
  { href: "/dashboard/user/responsablesRIA/comptabilite",           label: "Comptabilité",  icon: BookOpen },
  { href: "/dashboard/user/responsablesRIA/alertes",                label: "Alertes",       icon: AlertTriangle },
  { href: "/dashboard/user/responsablesRIA/documents",              label: "Documents",     icon: FolderOpen },
  { href: "/dashboard/user/responsablesRIA/config",                 label: "Config",        icon: Settings },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export default function ResponsableRIALayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-gradient-to-b from-emerald-800 to-emerald-950 text-white flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto lg:flex-shrink-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center justify-between gap-2 px-5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-md bg-white p-1 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm">
              <AfriSimeLogo className="w-full h-full object-contain" />
            </div>
            <Link href="/dashboard/user" className="flex items-center gap-1.5 text-xs text-emerald-100/80 hover:text-white transition-colors min-w-0">
              <Home className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">Accueil</span>
            </Link>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/70 hover:text-white flex-shrink-0">
            <X size={20} />
          </button>
        </div>
        <div className="px-5 py-3 border-b border-white/10 flex-shrink-0">
          <span className="text-sm font-bold flex items-center gap-1.5">
            <Shield className="w-4 h-4" /> RIA
          </span>
          <span className="text-xs text-emerald-200/70">Réseau des Investisseurs AfriSime</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  active
                    ? "bg-white/15 text-white shadow-inner"
                    : "text-emerald-100/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" /> {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="bg-white border-b border-slate-200 sticky top-0 z-30 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-2 px-4 py-3 text-slate-600 hover:text-slate-800"
          >
            <Menu size={20} /> <span className="text-sm font-semibold">Menu RIA</span>
          </button>
        </div>
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
