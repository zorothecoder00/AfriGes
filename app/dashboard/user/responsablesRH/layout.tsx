"use client";

// Layout de garde du portail RESPONSABLE_RH.
// Applique réellement les droits configurés (registre + config rôle/utilisateur) :
// chaque sous-page est rattachée à une clé de section ; si l'utilisateur n'y a pas
// accès, on affiche un écran de refus au lieu du contenu.
// Pendant le chargement des droits, on laisse passer (usePageAccess renvoie true)
// pour éviter tout flash de blocage. La page d'accueil (base) est toujours accessible.

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldOff, ArrowLeft } from "lucide-react";
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

export default function ResponsableRHLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isAllowed, loading } = usePageAccess();

  // /dashboard/user/responsablesRH/<segment>/...  → segment = index 4
  const segment = pathname.split("/")[4];
  const key = segment ? SEGMENT_TO_KEY[segment] : null; // base (dashboard) = toujours autorisé

  const denied = key != null && !loading && !isAllowed(key);

  if (denied) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
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
    );
  }

  return <>{children}</>;
}
