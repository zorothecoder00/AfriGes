"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  LayoutDashboard, BarChart3, Briefcase, TrendingUp, AlertCircle,
  Calendar, MapPin, Truck, AlertTriangle, ClipboardList,
  Users, UserCheck, CheckSquare, GitBranch, Zap, Lightbulb,
  Rocket, BarChart2, Home, ChevronRight, Map,
  ShieldAlert, Inbox, Search,
} from "lucide-react";
import SideTabs, { type SideTabItem, type SideTabsAccent } from "@/components/ui/SideTabs";

type NavItem = { href: string; label: string; icon: React.ElementType };

const COMMISSIONS: Record<string, {
  label: string;
  color: string; bg: string; activeClass: string; accent: SideTabsAccent;
  nav: NavItem[];
}> = {
  finance: {
    label: "Commission Finance",
    color: "text-blue-700", bg: "bg-blue-50",
    activeClass: "border-blue-600 text-blue-700", accent: "blue",
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
    activeClass: "border-emerald-600 text-emerald-700", accent: "emerald",
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
    activeClass: "border-amber-600 text-amber-700", accent: "amber",
    nav: [
      { href: "",                  label: "Vue d'ensemble",              icon: LayoutDashboard },
      { href: "/programme",        label: "Programme d'Audit",           icon: ClipboardList },
      { href: "/portefeuilles",    label: "Contrôle des Portefeuilles",  icon: Briefcase },
      { href: "/clients",          label: "Contrôle des Clients",        icon: Users },
      { href: "/agents",           label: "Contrôle des Agents",         icon: UserCheck },
      { href: "/anomalies",        label: "Gestion des Anomalies",       icon: AlertTriangle },
      { href: "/recommandations",  label: "Recommandations d'Audit",     icon: CheckSquare },
      { href: "/flux",             label: "Flux entrant",                icon: Inbox },
      { href: "/missions",         label: "Missions d'Audit",            icon: ShieldAlert },
    ],
  },
  optimisation: {
    label: "Commission Optimisation des Processus",
    color: "text-violet-700", bg: "bg-violet-50",
    activeClass: "border-violet-600 text-violet-700", accent: "violet",
    nav: [
      { href: "",               label: "Vue d'ensemble",             icon: LayoutDashboard },
      { href: "/processus",     label: "Cartographie des Processus", icon: GitBranch },
      { href: "/goulots",       label: "Goulots d'Étranglement",     icon: Zap },
      { href: "/suggestions",   label: "Suggestions d'Amélioration", icon: Lightbulb },
      { href: "/innovations",   label: "Gestion des Innovations",    icon: Rocket },
      { href: "/productivite",  label: "Productivité",               icon: BarChart2 },
      { href: "/rapports-recus",label: "Rapports reçus",             icon: Inbox },
      { href: "/analyses",      label: "Analyses d'Optimisation",    icon: Search },
    ],
  },
};

export default function CommissionLayout({ children }: { children: ReactNode }) {
  const { type } = useParams() as { type: string };
  const pathname  = usePathname();
  const config    = COMMISSIONS[type];
  const base      = `/dashboard/admin/ria/gouvernance/commissions/${type}`;

  if (!config) return <>{children}</>;

  const items: SideTabItem[] = config.nav.map(({ href, label, icon: Icon }) => {
    const fullHref = base + href;
    const active = href === ""
      ? pathname === base
      : pathname === fullHref || pathname.startsWith(fullHref + "/");
    return { key: href, href: fullHref, label, icon: <Icon className="w-3.5 h-3.5" />, active };
  });

  return (
    <div>
      {/* Breadcrumb + titre */}
      <div className={`${config.bg} border-b border-slate-200 px-6 pt-3 pb-3 flex items-center gap-1.5 text-xs text-slate-400`}>
        <Link href="/dashboard/admin/ria/gouvernance" className="flex items-center gap-1 hover:text-slate-600">
          <Home className="w-3 h-3" /> Gouvernance RIA
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className={`font-medium ${config.color}`}>{config.label}</span>
      </div>

      <div className="flex flex-col md:flex-row">
        {/* Sous-nav */}
        <SideTabs accent={config.accent} items={items} className={`${config.bg} px-3 py-2 md:py-4`} />

        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
