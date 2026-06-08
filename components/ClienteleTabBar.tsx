"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, AlertTriangle, Calendar, TrendingUp, ArrowLeft, LayoutDashboard, UserCheck, Bell, Shield, BarChart2, BellRing, CreditCard, Tag } from "lucide-react";

const TABS = [
  {
    href:  "/dashboard/admin/clientele",
    label: "Tableau de bord",
    icon:  <LayoutDashboard className="w-4 h-4" />,
    match: (p: string) => p === "/dashboard/admin/clientele",
  },
  {
    href:  "/dashboard/admin/clients",
    label: "Clients",
    icon:  <Users className="w-4 h-4" />,
    match: (p: string) => p === "/dashboard/admin/clients" || p.startsWith("/dashboard/admin/clients/"),
  },
  {
    href:  "/dashboard/admin/creances",
    label: "Créances",
    icon:  <AlertTriangle className="w-4 h-4" />,
    match: (p: string) => p.startsWith("/dashboard/admin/creances"),
  },
  {
    href:  "/dashboard/admin/collectes",
    label: "Collectes",
    icon:  <Calendar className="w-4 h-4" />,
    match: (p: string) => p.startsWith("/dashboard/admin/collectes"),
  },
  {
    href:  "/dashboard/admin/remboursements",
    label: "Remboursements",
    icon:  <TrendingUp className="w-4 h-4" />,
    match: (p: string) => p.startsWith("/dashboard/admin/remboursements"),
  },
  {
    href:  "/dashboard/admin/credits",
    label: "Crédits",
    icon:  <CreditCard className="w-4 h-4" />,
    match: (p: string) => p.startsWith("/dashboard/admin/credits"),
  },
  {
    href:  "/dashboard/admin/tags",
    label: "Tags",
    icon:  <Tag className="w-4 h-4" />,
    match: (p: string) => p.startsWith("/dashboard/admin/tags"),
  },
  {
    href:  "/dashboard/admin/agents-terrain",
    label: "Agents",
    icon:  <UserCheck className="w-4 h-4" />,
    match: (p: string) => p.startsWith("/dashboard/admin/agents-terrain"),
  },
  {
    href:  "/dashboard/admin/alertes-impayes",
    label: "Alertes",
    icon:  <Bell className="w-4 h-4" />,
    match: (p: string) => p.startsWith("/dashboard/admin/alertes-impayes"),
  },
  {
    href:  "/dashboard/admin/audit",
    label: "Audit",
    icon:  <Shield className="w-4 h-4" />,
    match: (p: string) => p.startsWith("/dashboard/admin/audit"),
  },
  {
    href:  "/dashboard/admin/notifications",
    label: "Notifications",
    icon:  <BellRing className="w-4 h-4" />,
    match: (p: string) => p.startsWith("/dashboard/admin/notifications"),
  },
  {
    href:  "/dashboard/admin/rapports",
    label: "Rapports",
    icon:  <BarChart2 className="w-4 h-4" />,
    match: (p: string) => p.startsWith("/dashboard/admin/rapports"),
  },
];

export default function ClienteleTabBar() {
  const pathname = usePathname();

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="px-6 pt-4 pb-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-3">
          <Link
            href="/dashboard/admin"
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" /> Dashboard
          </Link>
          <span className="text-gray-300 text-xs">/</span>
          <span className="text-xs font-semibold text-gray-700">Gestion clientèle</span>
        </div>

        {/* Module title */}
        <h1 className="text-xl font-bold text-gray-900 mb-3">Gestion de la clientèle</h1>

        {/* Tabs */}
        <nav className="flex gap-1 -mb-px overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`
                  flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                  ${active
                    ? "border-blue-600 text-blue-700 bg-blue-50/50"
                    : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300 hover:bg-gray-50"
                  }
                `}
              >
                {tab.icon}
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
