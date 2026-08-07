"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Megaphone, Users, MessageCircle, Image as ImageIcon, Zap, Settings, Tag, Gift, Users2,
  MapPin, Rocket, Star, BarChart3, Wallet, Building2, Briefcase, CalendarDays, Share2,
} from "lucide-react";

const BASE = "/dashboard/admin/marketing";

// Ordre aligné sur le Marketing Hub du CDC (§2) : Tableau de bord → Centre de
// campagnes → Segmentation & Audiences → Communication → Bibliothèque
// Marketing → Promotions & Offres → Fidélisation → Parrainage → Animation des
// agences → Marketing B2B → Événementiel → Marketing terrain → Social Media →
// Marketing Digital → Automatisation → Marketing Analytics → Budget Marketing
// → Paramètres. "Partenaires" (influenceurs/affiliés, §47-49) n'est pas un
// item du menu CDC mais une fonctionnalité réelle — conservé en plus.
const NAV_ITEMS = [
  { href: `${BASE}`,                 label: "Tableau de bord",     icon: LayoutDashboard, exact: true },
  { href: `${BASE}/campagnes`,       label: "Campagnes",           icon: Megaphone },
  { href: `${BASE}/audiences`,       label: "Audiences",           icon: Users },
  { href: `${BASE}/communication`,   label: "Communication",       icon: MessageCircle },
  { href: `${BASE}/contenu`,         label: "Bibliothèque",        icon: ImageIcon },
  { href: `${BASE}/promotions`,      label: "Promotions",          icon: Tag },
  { href: `${BASE}/fidelisation`,    label: "Fidélisation",        icon: Gift },
  { href: `${BASE}/parrainage`,      label: "Parrainage",          icon: Users2 },
  { href: `${BASE}/animation-agences`, label: "Animation agences", icon: Building2 },
  { href: `${BASE}/b2b`,             label: "Marketing B2B",       icon: Briefcase },
  { href: `${BASE}/evenementiel`,    label: "Événementiel",        icon: CalendarDays },
  { href: `${BASE}/terrain`,         label: "Marketing terrain",   icon: MapPin },
  { href: `${BASE}/social-media`,    label: "Social Media",        icon: Share2 },
  { href: `${BASE}/acquisition`,     label: "Marketing Digital",   icon: Rocket },
  { href: `${BASE}/automatisation`,  label: "Automatisation",      icon: Zap },
  { href: `${BASE}/analytics`,       label: "Analytics",           icon: BarChart3 },
  { href: `${BASE}/budget`,          label: "Budget",              icon: Wallet },
  { href: `${BASE}/partenaires`,     label: "Partenaires",         icon: Star },
  { href: `${BASE}/parametres`,      label: "Paramètres",          icon: Settings },
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
