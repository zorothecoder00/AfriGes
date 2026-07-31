"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, UserCheck, ClipboardList, Banknote, Gift,
  CalendarDays, Clock, CalendarClock, CalendarRange, Brain, Rocket,
  MapPin, Star, FileWarning, Building2, ShieldAlert, FileText,
  FolderOpen, History, ChevronRight, Home,
} from "lucide-react";
import SideTabs, { type SideTabItem } from "@/components/ui/SideTabs";

// ── Navigation RH ────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: "/dashboard/admin/rh",                       label: "Dashboard",              icon: LayoutDashboard, exact: true },
  { href: "/dashboard/admin/rh/collaborateurs",        label: "Collaborateurs",         icon: Users },
  { href: "/dashboard/admin/rh/recrutement",           label: "Recrutement",            icon: UserCheck },
  { href: "/dashboard/admin/rh/onboarding",            label: "Onboarding",             icon: ClipboardList },
  { href: "/dashboard/admin/rh/paie",                  label: "Paie",                   icon: Banknote },
  { href: "/dashboard/admin/rh/avantages",             label: "Avantages",              icon: Gift },
  { href: "/dashboard/admin/rh/conges",                label: "Congés",                 icon: CalendarDays },
  { href: "/dashboard/admin/rh/pointages",             label: "Pointages",              icon: Clock },
  { href: "/dashboard/admin/rh/horaires",              label: "Horaires",               icon: CalendarClock },
  { href: "/dashboard/admin/rh/planning",              label: "Planning d'équipe",      icon: CalendarRange },
  { href: "/dashboard/admin/rh/competences",           label: "Compétences",            icon: Brain },
  { href: "/dashboard/admin/rh/carrieres",             label: "Carrières",              icon: Rocket },
  { href: "/dashboard/admin/rh/missions",              label: "Missions",               icon: MapPin },
  { href: "/dashboard/admin/rh/evaluations",           label: "Évaluations",            icon: Star },
  { href: "/dashboard/admin/rh/disciplinaire",         label: "Disciplinaire",          icon: FileWarning },
  { href: "/dashboard/admin/rh/organigramme",          label: "Organigramme",           icon: Building2 },
  { href: "/dashboard/admin/rh/sst",                   label: "Santé & Sécurité",       icon: ShieldAlert },
  { href: "/dashboard/admin/rh/documents-rh",          label: "Documents RH",           icon: FileText },
  { href: "/dashboard/admin/rh/documents-strategiques",label: "Documents stratégiques", icon: FolderOpen },
  { href: "/dashboard/admin/rh/audit",                 label: "Audit & Traçabilité",    icon: History },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function RHLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const items: SideTabItem[] = NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => ({
    key: href,
    href,
    label,
    icon: <Icon className="w-3.5 h-3.5" />,
    active: isActive(pathname, href, exact),
  }));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-slate-200 px-6 pt-3 pb-3 flex items-center gap-1.5 text-xs text-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500">
        <Link href="/dashboard/admin" className="flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          <Home className="w-3 h-3" /> Admin
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-primary-600 dark:text-primary-400 font-medium">RH — Ressources Humaines</span>
      </div>

      <div className="flex flex-col md:flex-row">
        {/* ── Onglets ── */}
        <SideTabs
          accent="brand"
          items={items}
          expandedWidthClass="md:w-56"
          className="bg-white px-3 md:px-3 py-2 md:py-4 md:sticky md:top-0 md:h-[calc(100vh-49px)] md:overflow-y-auto dark:bg-slate-800 dark:border-slate-700"
        />

        {/* ── Contenu ── */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
