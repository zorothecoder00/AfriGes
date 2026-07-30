"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Wallet, Activity,
  UserCheck, DollarSign, Settings, ChevronRight, Home,
  ArrowDownUp, Star, TrendingUp, FileText, Award, BarChart2, Shield,
  Briefcase, ClipboardList, Calculator, AlertTriangle, FolderOpen,
} from "lucide-react";
import SideTabs, { type SideTabItem } from "@/components/ui/SideTabs";

// ── Navigation RIA ────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: "/dashboard/admin/ria",                label: "Dashboard",      icon: LayoutDashboard, exact: true },
  { href: "/dashboard/admin/ria/investisseurs",  label: "Investisseurs",  icon: Users },
  { href: "/dashboard/admin/ria/portefeuilles",  label: "Portefeuilles",  icon: Briefcase },
  { href: "/dashboard/admin/ria/fonds",          label: "Fonds",          icon: Wallet },
  { href: "/dashboard/admin/ria/financements",   label: "Financements",   icon: Activity },
  { href: "/dashboard/admin/ria/affectations",   label: "Affectations",   icon: UserCheck },
  { href: "/dashboard/admin/ria/recouvrement",   label: "Recouvrement",   icon: ArrowDownUp },
  { href: "/dashboard/admin/ria/scoring",        label: "Scoring",        icon: Star },
  { href: "/dashboard/admin/ria/benefices",      label: "Bénéfices",      icon: TrendingUp },
  { href: "/dashboard/admin/ria/reporting",      label: "Reporting",      icon: FileText },
  { href: "/dashboard/admin/ria/rapports",       label: "Rapports",       icon: ClipboardList },
  { href: "/dashboard/admin/ria/commissions",    label: "Commissions",    icon: Award },
  { href: "/dashboard/admin/ria/distributions",  label: "Distributions",  icon: DollarSign },
  { href: "/dashboard/admin/ria/comptabilite",   label: "Comptabilité",   icon: Calculator },
  { href: "/dashboard/admin/ria/alertes",        label: "Alertes",        icon: AlertTriangle },
  { href: "/dashboard/admin/ria/documents",      label: "Documents",      icon: FolderOpen },
  { href: "/dashboard/admin/ria/bi",             label: "BI",             icon: BarChart2 },
  { href: "/dashboard/admin/ria/gouvernance",    label: "Gouvernance",    icon: Shield },
  { href: "/dashboard/admin/ria/config",         label: "Configuration",  icon: Settings },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function RIALayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const items: SideTabItem[] = NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => ({
    key: href,
    href,
    label,
    icon: <Icon className="w-3.5 h-3.5" />,
    active: isActive(pathname, href, exact),
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-slate-200 px-6 pt-3 pb-3 flex items-center gap-1.5 text-xs text-slate-400">
        <Link href="/dashboard/admin" className="flex items-center gap-1 hover:text-slate-600 transition-colors">
          <Home className="w-3 h-3" /> Admin
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-primary-600 font-medium">RIA — Réseau des Investisseurs AfriSime</span>
      </div>

      <div className="flex flex-col md:flex-row">
        {/* ── Onglets ── */}
        <SideTabs
          accent="brand"
          items={items}
          className="bg-white px-3 md:px-3 py-2 md:py-4 md:sticky md:top-0 md:h-[calc(100vh-49px)] md:overflow-y-auto"
        />

        {/* ── Contenu ── */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
