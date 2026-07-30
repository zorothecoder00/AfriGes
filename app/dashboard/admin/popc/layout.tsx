"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Target, CalendarCheck, LayoutDashboard, Bell, PackagePlus, FileText, ArrowLeft } from "lucide-react";
import SideTabs, { type SideTabItem } from "@/components/ui/SideTabs";

const TABS = [
  { href: "/dashboard/admin/popc", label: "Objectifs", icon: Target },
  { href: "/dashboard/admin/popc/livraisons", label: "Planif. crédits", icon: PackagePlus },
  { href: "/dashboard/admin/popc/suivi", label: "Suivi journalier", icon: CalendarCheck },
  { href: "/dashboard/admin/popc/direction", label: "Pilotage Direction", icon: LayoutDashboard },
  { href: "/dashboard/admin/popc/alertes", label: "Alertes", icon: Bell },
  { href: "/dashboard/admin/popc/rapports", label: "Rapports", icon: FileText },
];

export default function PopcLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const items: SideTabItem[] = TABS.map((t) => ({
    key: t.href,
    href: t.href,
    label: t.label,
    icon: <t.icon className="w-4 h-4" />,
    active: pathname === t.href,
  }));

  return (
    <div className="flex flex-col md:flex-row">
      <div className="px-4 md:pl-6 md:pr-0 pt-4 shrink-0">
        <Link href="/dashboard/admin" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3">
          <ArrowLeft size={15} /> Dashboard Admin
        </Link>
        <SideTabs accent="brand" items={items} />
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
