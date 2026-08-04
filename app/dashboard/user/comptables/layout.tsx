"use client";

// Layout de garde du portail COMPTABLE (niveau 1 — 13 rubriques du CDC Comptabilité).
// Remplace l'ancien système à onglets internes (activeTab) par une vraie sidebar
// hiérarchique + sous-routes Next.js, calqué sur app/dashboard/user/responsablesRH/layout.tsx.
// Chaque sous-page reste rattachée à une clé du registre (lib/pagesRegistry.ts,
// rôle COMPTABLE) — les clés n'ont pas changé pour ne pas invalider les droits déjà
// configurés (RolePageAccess/UserPermission) ; seul leur regroupement visuel change.

import { useState, type ReactNode } from "react";
import Link from "next/link";
import AfriSimeLogo from "@/components/AfriSimeLogo";
import { usePathname } from "next/navigation";
import {
  ShieldOff, ArrowLeft, Home, LayoutDashboard, PenSquare, BookOpen, BookMarked,
  Users, Wallet, Percent, Building2, TrendingUp, ClipboardCheck, FileText,
  CheckCircle, Settings, Menu, X, Calculator,
} from "lucide-react";
import { usePageAccess } from "@/hooks/usePageAccess";
import { useT } from "@/contexts/AppSettingsContext";
import NotificationBell from "@/components/NotificationBell";
import AccountMenuButton from "@/components/AccountMenuButton";
import CongesNavButton from "@/components/CongesNavButton";
import MessagesLink from "@/components/MessagesLink";
import UserPdvBadge from "@/components/UserPdvBadge";
import DashboardBackButton from "@/components/DashboardBackButton";

const BASE = "/dashboard/user/comptables";

const NAV = [
  { href: BASE,                          label: "Tableau de bord",        icon: LayoutDashboard, exact: true },
  { href: `${BASE}/saisie`,              label: "Saisie comptable",       icon: PenSquare,  key: "saisie" },
  { href: `${BASE}/journaux`,            label: "Journaux",               icon: BookOpen,   key: "journal" },
  { href: `${BASE}/plan-comptable`,      label: "Plan comptable",         icon: BookMarked, key: "plan" },
  { href: `${BASE}/auxiliaire`,          label: "Comptabilité auxiliaire", icon: Users,     key: "auxiliaire" },
  { href: `${BASE}/tresorerie`,          label: "Trésorerie",             icon: Wallet,     key: "tresorerie" },
  { href: `${BASE}/fiscalite`,           label: "Fiscalité",              icon: Percent,    key: "tva" },
  { href: `${BASE}/immobilisations`,     label: "Immobilisations",        icon: Building2,  key: "immobilisations" },
  { href: `${BASE}/analytique`,          label: "Analytique",             icon: TrendingUp, key: "analytique" },
  { href: `${BASE}/inventaire-cloture`,  label: "Inventaire & clôture",   icon: ClipboardCheck, key: "inventaire" },
  { href: `${BASE}/etats-financiers`,    label: "États financiers",       icon: FileText,   key: "etatsReels" },
  { href: `${BASE}/controles`,           label: "Contrôles comptables",   icon: CheckCircle, key: "controles" },
  { href: `${BASE}/parametres`,          label: "Paramètres",             icon: Settings,   key: "configInitiale" },
];

// Résolution clé d'accès par chemin — du plus spécifique au moins spécifique
// (plusieurs sous-pages d'une même rubrique peuvent porter des clés différentes).
const PATH_TO_KEY: { prefix: string; key: string }[] = [
  { prefix: `${BASE}/saisie/nouvelle`, key: "saisie" },
  { prefix: `${BASE}/saisie/recurrentes`, key: "recurrentes" },
  { prefix: `${BASE}/saisie/pieces`, key: "pieces" },
  { prefix: `${BASE}/saisie`, key: "saisie" },
  { prefix: `${BASE}/journaux`, key: "journal" },
  { prefix: `${BASE}/plan-comptable`, key: "plan" },
  { prefix: `${BASE}/auxiliaire`, key: "auxiliaire" },
  { prefix: `${BASE}/tresorerie/rapprochement`, key: "rapprochement" },
  { prefix: `${BASE}/tresorerie`, key: "tresorerie" },
  { prefix: `${BASE}/fiscalite/taxes`, key: "taxes" },
  { prefix: `${BASE}/fiscalite`, key: "tva" },
  { prefix: `${BASE}/immobilisations`, key: "immobilisations" },
  { prefix: `${BASE}/analytique`, key: "analytique" },
  { prefix: `${BASE}/inventaire-cloture/provisions`, key: "provisions" },
  { prefix: `${BASE}/inventaire-cloture/regularisations`, key: "regularisations" },
  { prefix: `${BASE}/inventaire-cloture/charges-produits-attente`, key: "chargesProduitsAttente" },
  { prefix: `${BASE}/inventaire-cloture/engagements-hors-bilan`, key: "engagementsHorsBilan" },
  { prefix: `${BASE}/inventaire-cloture/exercices`, key: "exercices" },
  { prefix: `${BASE}/inventaire-cloture`, key: "inventaire" },
  { prefix: `${BASE}/etats-financiers/balance`, key: "balance" },
  { prefix: `${BASE}/etats-financiers/grand-livre`, key: "grandlivre" },
  { prefix: `${BASE}/etats-financiers`, key: "etatsReels" },
  { prefix: `${BASE}/controles`, key: "controles" },
  { prefix: `${BASE}/parametres/regles`, key: "regles" },
  { prefix: `${BASE}/parametres/import`, key: "importEcritures" },
  { prefix: `${BASE}/parametres/rapports-gestion`, key: "rapportsGestion" },
  { prefix: `${BASE}/parametres`, key: "configInitiale" },
];

function resoudreCle(pathname: string): string | null {
  if (pathname === BASE) return null; // tableau de bord — toujours accessible
  const match = PATH_TO_KEY.find((p) => pathname === p.prefix || pathname.startsWith(p.prefix + "/"));
  return match?.key ?? null;
}

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export default function ComptablesLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isAllowed, loading } = usePageAccess();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const t = useT();

  const key = resoudreCle(pathname);
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
            <Calculator className="w-4 h-4" /> Comptabilité
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
        {/* Topbar (desktop + mobile) — remplace le header inline de l'ex-monolithe,
            partagé désormais par toutes les sous-pages via ce layout. */}
        <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 flex-shrink-0"
                >
                  <Menu size={22} />
                </button>
                <div className="hidden lg:flex items-center gap-2 min-w-0">
                  <DashboardBackButton />
                  <h1 className="text-base font-bold text-slate-800 truncate">{t("role_comptable_title")}</h1>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <UserPdvBadge />
                <MessagesLink />
                <CongesNavButton />
                <NotificationBell href="/dashboard/user/notifications" />
                <AccountMenuButton settingsHref="/dashboard/user/parametres" catalogueHref="/dashboard/user/catalogue" inline />
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 min-w-0">
          {denied ? (
            <div className="min-h-screen flex items-center justify-center p-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm max-w-md w-full p-8 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
                  <ShieldOff className="w-7 h-7 text-red-500" />
                </div>
                <h1 className="text-lg font-bold text-slate-900">Accès non autorisé</h1>
                <p className="text-sm text-slate-500 mt-2">
                  Vous n&apos;avez pas accès à cette section comptable. Contactez votre administrateur
                  si vous pensez que c&apos;est une erreur.
                </p>
                <Link
                  href={BASE}
                  className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Retour au tableau de bord comptable
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
