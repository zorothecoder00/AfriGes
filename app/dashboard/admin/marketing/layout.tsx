"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Megaphone, Users, MessageCircle, Settings } from "lucide-react";

const BASE = "/dashboard/admin/marketing";

const NAV_ITEMS = [
  { href: `${BASE}`,               label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { href: `${BASE}/campagnes`,     label: "Campagnes",       icon: Megaphone },
  { href: `${BASE}/audiences`,     label: "Audiences",       icon: Users },
  { href: `${BASE}/communication`, label: "Communication",   icon: MessageCircle },
  { href: `${BASE}/parametres`,    label: "Paramètres",      icon: Settings },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export default function MarketingLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div>
      <div className="bg-white border-b border-slate-100 -mx-5 md:-mx-8 px-5 md:px-8 mb-6">
        <nav className="flex items-end gap-0.5 overflow-x-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact);
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  active ? "border-fuchsia-600 text-fuchsia-700" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}>
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
