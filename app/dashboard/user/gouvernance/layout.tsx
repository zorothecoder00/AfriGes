"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import AfriSimeLogo from "@/components/AfriSimeLogo";
import { usePathname } from "next/navigation";
import {
  Home, Shield, Calendar, ListChecks,
  GitBranch, Gavel, MessageSquare, Menu, X,
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-gradient-to-b from-emerald-800 to-emerald-950 text-white flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto lg:flex-shrink-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center justify-between gap-2 px-5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-md bg-white p-1 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm">
              <AfriSimeLogo className="w-full h-full object-contain" />
            </div>
            <Link href="/dashboard/user" className="flex items-center gap-1.5 text-xs text-emerald-100/80 hover:text-white transition-colors min-w-0">
              <Home className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">Accueil</span>
            </Link>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/70 hover:text-white flex-shrink-0">
            <X size={20} />
          </button>
        </div>
        <div className="px-5 py-3 border-b border-white/10 flex-shrink-0">
          <span className="text-sm font-bold flex items-center gap-1.5">
            <Shield className="w-4 h-4" /> Gouvernance RIA
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  active
                    ? "bg-white/15 text-white shadow-inner"
                    : "text-emerald-100/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" /> {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="bg-white border-b border-slate-200 sticky top-0 z-30 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-2 px-4 py-3 text-slate-600 hover:text-slate-800"
          >
            <Menu size={20} /> <span className="text-sm font-semibold">Menu Gouvernance</span>
          </button>
        </div>
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
