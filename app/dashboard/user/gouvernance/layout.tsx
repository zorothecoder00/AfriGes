"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, ChevronRight, Shield, Calendar, ListChecks,
  GitBranch, Gavel, MessageSquare,
} from "lucide-react";

// Portail de gouvernance dédié aux membres de commission (tout rôle confondu).
// Volontairement léger : il n'embarque pas la navigation de gestion RIA
// (réservée au RESPONSABLE_RIA / Admin), uniquement le contexte gouvernance.

const BASE = "/dashboard/user/gouvernance";

const NAV = [
  { href: BASE,                  label: "Mes commissions", icon: Shield,        exact: true },
  { href: `${BASE}/reunions`,    label: "Réunions",        icon: Calendar },
  { href: `${BASE}/plans-actions`, label: "Plans d'action", icon: ListChecks },
  { href: `${BASE}/dossiers`,    label: "Dossiers IC",     icon: GitBranch },
  { href: `${BASE}/resolutions`, label: "Résolutions",     icon: Gavel },
  { href: `${BASE}/observations`, label: "Collaboration",  icon: MessageSquare },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export default function GouvernancePortailLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="px-6 pt-3 flex items-center gap-1.5 text-xs text-slate-400">
          <Link href="/dashboard/user" className="flex items-center gap-1 hover:text-slate-600 transition-colors">
            <Home className="w-3 h-3" /> Accueil
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-emerald-600 font-medium flex items-center gap-1">
            <Shield className="w-3 h-3" /> Gouvernance RIA
          </span>
        </div>
        <nav className="px-6 flex items-end gap-0.5 overflow-x-auto">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact);
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  active
                    ? "border-emerald-600 text-emerald-700"
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
