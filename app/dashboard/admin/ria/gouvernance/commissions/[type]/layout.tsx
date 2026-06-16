"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  LayoutDashboard, BarChart3, Briefcase, TrendingUp, AlertCircle,
  Calendar, MapPin, Truck, AlertTriangle, ClipboardList,
  Users, UserCheck, CheckSquare, GitBranch, Zap, Lightbulb,
  Rocket, BarChart2, DollarSign, Home, ChevronRight, Map,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: React.ElementType };

const COMMISSIONS: Record<string, {
  label: string;
  color: string; bg: string; activeClass: string;
  nav: NavItem[];
}> = {
  finance: {
    label: "Commission Finance",
    color: "text-blue-700", bg: "bg-blue-50",
    activeClass: "border-blue-600 text-blue-700",
    nav: [
      { href: "",                  label: "Vue d'ensemble",              icon: LayoutDashboard },
      { href: "/tableau-bord",     label: "Tableau de Bord Financier",   icon: BarChart3 },
      { href: "/portefeuilles",    label: "Analyse des Portefeuilles",   icon: Briefcase },
      { href: "/investissements",  label: "Contrôle des Investissements",icon: TrendingUp },
      { href: "/creances",         label: "Analyse des Créances",        icon: AlertCircle },
      { href: "/previsions",       label: "Prévisions Financières",      icon: Calendar },
    ],
  },
  "operations-terrain": {
    label: "Commission Opérations Terrain & Approvisionnement",
    color: "text-emerald-700", bg: "bg-emerald-50",
    activeClass: "border-emerald-600 text-emerald-700",
    nav: [
      { href: "",                      label: "Vue d'ensemble",                   icon: LayoutDashboard },
      { href: "/activites",            label: "Activités Terrain",                icon: MapPin },
      { href: "/approvisionnements",   label: "Approvisionnements",               icon: Truck },
      { href: "/performance",          label: "Performance Commerciale",          icon: TrendingUp },
      { href: "/cartographie",         label: "Cartographie des Portefeuilles",   icon: Map },
      { href: "/risques",              label: "Gestion des Risques Terrain",      icon: AlertTriangle },
    ],
  },
  "audit-controle": {
    label: "Commission Audit & Contrôle Interne",
    color: "text-amber-700", bg: "bg-amber-50",
    activeClass: "border-amber-600 text-amber-700",
    nav: [
      { href: "",                  label: "Vue d'ensemble",              icon: LayoutDashboard },
      { href: "/programme",        label: "Programme d'Audit",           icon: ClipboardList },
      { href: "/portefeuilles",    label: "Contrôle des Portefeuilles",  icon: Briefcase },
      { href: "/clients",          label: "Contrôle des Clients",        icon: Users },
      { href: "/agents",           label: "Contrôle des Agents",         icon: UserCheck },
      { href: "/anomalies",        label: "Gestion des Anomalies",       icon: AlertTriangle },
      { href: "/recommandations",  label: "Recommandations d'Audit",     icon: CheckSquare },
    ],
  },
  optimisation: {
    label: "Commission Optimisation des Processus",
    color: "text-violet-700", bg: "bg-violet-50",
    activeClass: "border-violet-600 text-violet-700",
    nav: [
      { href: "",               label: "Vue d'ensemble",             icon: LayoutDashboard },
      { href: "/processus",     label: "Cartographie des Processus", icon: GitBranch },
      { href: "/goulots",       label: "Goulots d'Étranglement",     icon: Zap },
      { href: "/suggestions",   label: "Suggestions d'Amélioration", icon: Lightbulb },
      { href: "/innovations",   label: "Gestion des Innovations",    icon: Rocket },
      { href: "/productivite",  label: "Productivité",               icon: BarChart2 },
    ],
  },
};

export default function CommissionLayout({ children }: { children: ReactNode }) {
  const { type } = useParams() as { type: string };
  const pathname  = usePathname();
  const config    = COMMISSIONS[type];
  const base      = `/dashboard/admin/ria/gouvernance/commissions/${type}`;

  if (!config) return <>{children}</>;

  return (
    <div>
      {/* Breadcrumb + titre */}
      <div className={`${config.bg} border-b border-slate-200`}>
        <div className="px-6 pt-3 flex items-center gap-1.5 text-xs text-slate-400">
          <Link href="/dashboard/admin/ria/gouvernance" className="flex items-center gap-1 hover:text-slate-600">
            <Home className="w-3 h-3" /> Gouvernance RIA
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className={`font-medium ${config.color}`}>{config.label}</span>
        </div>

        {/* Sous-nav */}
        <nav className="px-6 flex items-end gap-0.5 overflow-x-auto">
          {config.nav.map(({ href, label, icon: Icon }) => {
            const fullHref = base + href;
            const active   = href === ""
              ? pathname === base
              : pathname === fullHref || pathname.startsWith(fullHref + "/");
            return (
              <Link key={href} href={fullHref}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  active
                    ? config.activeClass
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}>
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
