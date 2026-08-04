"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scale, BookOpen, Landmark, TrendingUp, Wallet, FileText } from "lucide-react";

const BASE = "/dashboard/user/comptables/etats-financiers";

// Le lien "Journaux" du CDC pointe vers la rubrique Journaux existante
// (/dashboard/user/comptables/journaux), qui n'est pas une sous-page de celle-ci —
// volontairement non dupliquée ici pour ne pas fragmenter cette donnée.
const NAV_ITEMS = [
  { href: `${BASE}/balance`,           label: "Balance",                              icon: Scale },
  { href: `${BASE}/grand-livre`,       label: "Grand livre",                          icon: BookOpen },
  { href: `${BASE}/bilan`,             label: "Bilan",                                icon: Landmark },
  { href: `${BASE}/resultat`,          label: "Compte de résultat",                   icon: TrendingUp },
  { href: `${BASE}/flux-tresorerie`,   label: "Tableau des flux de trésorerie",       icon: Wallet },
  { href: `${BASE}/notes-annexes`,     label: "Notes annexes",                        icon: FileText },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export default function EtatsFinanciersLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div>
      <div className="bg-white border-b border-slate-100">
        <nav className="px-6 flex items-end gap-0.5 overflow-x-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
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
