"use client";

// Layout de garde du portail RESPONSABLE_RH.
// Applique réellement les droits configurés (registre + config rôle/utilisateur) :
// chaque sous-page est rattachée à une clé de section ; si l'utilisateur n'y a pas
// accès, on affiche un écran de refus au lieu du contenu.
// Pendant le chargement des droits, on laisse passer (usePageAccess renvoie true)
// pour éviter tout flash de blocage. La page d'accueil (base) est toujours accessible.

import { useState, type ReactNode } from "react";
import Link from "next/link";
import AfriSimeLogo from "@/components/AfriSimeLogo";
import { usePathname } from "next/navigation";
import {
  ShieldOff, ArrowLeft, Home, LayoutDashboard, Users, Clock, Calendar,
  Briefcase, MapPin, DollarSign, UserCheck, Star, GraduationCap,
  HeartPulse, Gavel, FileText, Network, ClipboardList, Settings, Bell,
  Menu, X,
} from "lucide-react";
import { usePageAccess } from "@/hooks/usePageAccess";

const BASE = "/dashboard/user/responsablesRH";

// Segment d'URL (après .../responsablesRH/) → clé de section du registre.
const SEGMENT_TO_KEY: Record<string, string> = {
  collaborateurs: "collaborateurs",
  pointages:      "pointages",
  conges:         "conges",
  recrutement:    "recrutement",
  missions:       "missions",
  paie:           "paie",
  onboarding:     "onboarding",
  audit:          "audit",
  preferences:    "preferences",
  notifications:  "notifications",
};

const NAV = [
  { href: BASE,                              label: "Dashboard",              icon: LayoutDashboard, exact: true },
  { href: `${BASE}/collaborateurs`,          label: "Collaborateurs",         icon: Users,        key: "collaborateurs" },
  { href: `${BASE}/pointages`,               label: "Pointages",              icon: Clock,        key: "pointages" },
  { href: `${BASE}/conges`,                  label: "Congés",                 icon: Calendar,     key: "conges" },
  { href: `${BASE}/recrutement`,             label: "Recrutement",            icon: Briefcase,    key: "recrutement" },
  { href: `${BASE}/missions`,                label: "Missions",               icon: MapPin,       key: "missions" },
  { href: `${BASE}/paie`,                    label: "Paie",                   icon: DollarSign,   key: "paie" },
  { href: `${BASE}/onboarding`,              label: "Onboarding",             icon: UserCheck,    key: "onboarding" },
  { href: `${BASE}/evaluations`,             label: "Évaluations",            icon: Star },
  { href: `${BASE}/formations`,              label: "Formations",             icon: GraduationCap },
  { href: `${BASE}/sst`,                     label: "SST",                    icon: HeartPulse },
  { href: `${BASE}/disciplinaire`,           label: "Disciplinaire",          icon: Gavel },
  { href: `${BASE}/documents-strategiques`,  label: "Documents stratégiques", icon: FileText },
  { href: `${BASE}/organigramme`,            label: "Organigramme",           icon: Network },
  { href: `${BASE}/audit`,                   label: "Audit",                  icon: ClipboardList, key: "audit" },
  { href: `${BASE}/preferences`,             label: "Préférences",            icon: Settings,      key: "preferences" },
  { href: `${BASE}/notifications`,           label: "Déclencheurs",           icon: Bell,          key: "notifications" },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export default function ResponsableRHLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isAllowed, loading } = usePageAccess();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // /dashboard/user/responsablesRH/<segment>/...  → segment = index 4
  const segment = pathname.split("/")[4];
  const key = segment ? SEGMENT_TO_KEY[segment] : null; // base (dashboard) = toujours autorisé

  const denied = key != null && !loading && !isAllowed(key);

  const visibleNav = NAV.filter((item) => !item.key || loading || isAllowed(item.key));

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
            <Users className="w-4 h-4" /> Ressources Humaines
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleNav.map(({ href, label, icon: Icon, exact }) => {
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
            <Menu size={20} /> <span className="text-sm font-semibold">Menu RH</span>
          </button>
        </div>
        <div className="flex-1 min-w-0">
          {denied ? (
            <div className="min-h-screen flex items-center justify-center p-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm max-w-md w-full p-8 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
                  <ShieldOff className="w-7 h-7 text-red-500" />
                </div>
                <h1 className="text-lg font-bold text-slate-900">Accès non autorisé</h1>
                <p className="text-sm text-slate-500 mt-2">
                  Vous n&apos;avez pas accès à cette section RH. Contactez votre administrateur
                  si vous pensez que c&apos;est une erreur.
                </p>
                <Link
                  href={BASE}
                  className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Retour au tableau de bord RH
                </Link>
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
