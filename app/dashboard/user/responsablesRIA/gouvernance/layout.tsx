"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Shield, Calendar, Gavel,
  ListChecks, GitBranch, BarChart3, MessageSquare,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard/user/responsablesRIA/gouvernance",                  exact: true, label: "Tableau de bord", icon: Shield },
  { href: "/dashboard/user/responsablesRIA/gouvernance/reunions",         label: "Mes réunions",    icon: Calendar },
  { href: "/dashboard/user/responsablesRIA/gouvernance/resolutions",      label: "Résolutions",     icon: Gavel },
  { href: "/dashboard/user/responsablesRIA/gouvernance/plans-actions",    label: "Plans d'action",  icon: ListChecks },
  { href: "/dashboard/user/responsablesRIA/gouvernance/dossiers",         label: "Dossiers IC",     icon: GitBranch },
  { href: "/dashboard/user/responsablesRIA/gouvernance/rapports",         label: "Rapports",        icon: BarChart3 },
  { href: "/dashboard/user/responsablesRIA/gouvernance/observations",     label: "Collaboration",   icon: MessageSquare },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export default function GouvernanceRIALayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div>
      <div className="bg-white border-b border-slate-100">
        <nav className="px-6 flex items-end gap-0.5 overflow-x-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact);
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  active ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
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
