"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Target, CalendarCheck, LayoutDashboard, Bell, PackagePlus, FileText, ArrowLeft } from "lucide-react";

const TABS = [
  { href: "/dashboard/admin/popc", label: "Objectifs", icon: Target },
  { href: "/dashboard/admin/popc/livraisons", label: "Planif. crédits", icon: PackagePlus },
  { href: "/dashboard/admin/popc/suivi", label: "Suivi journalier", icon: CalendarCheck },
  { href: "/dashboard/admin/popc/direction", label: "Pilotage Direction", icon: LayoutDashboard },
  { href: "/dashboard/admin/popc/alertes", label: "Alertes", icon: Bell },
  { href: "/dashboard/admin/popc/rapports", label: "Rapports", icon: FileText },
];

export default function PopcTabs() {
  const pathname = usePathname();
  return (
    <div className="space-y-3">
      <Link href="/dashboard/admin" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> Dashboard Admin
      </Link>
      <div className="flex flex-wrap gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {TABS.map((t) => {
          const active = pathname === t.href;
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                active ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}>
              <Icon className="w-4 h-4" /> {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
