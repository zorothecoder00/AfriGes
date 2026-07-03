"use client";

import Link from "next/link";
import { CalendarDays, Wallet } from "lucide-react";
import { useApi } from "@/hooks/useApi";

/**
 * Entrées de menu libre-service collaborateur à placer dans l'en-tête des
 * portails gestionnaires : « Congés » et « Avances & prêts ».
 *
 * Auto-masqué si l'utilisateur connecté n'a pas de dossier RH (ProfilRH) :
 * on réutilise l'endpoint léger du pointage, qui renvoie { profilRH: null }
 * dans ce cas.
 */
export default function CongesNavButton() {
  const { data } = useApi<{ profilRH: { id: number } | null }>(
    "/api/collaborateur/pointage/today",
  );

  // Tant que la donnée n'est pas chargée, on n'affiche rien pour éviter un flash ;
  // une fois chargée, on masque si le compte n'a pas de dossier RH.
  if (!data || data.profilRH === null) return null;

  return (
    <>
      <Link
        href="/dashboard/user/collaborateur/conges"
        title="Congés & absences"
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <CalendarDays size={16} />
        <span className="hidden sm:inline">Congés</span>
      </Link>
      <Link
        href="/dashboard/user/collaborateur/avances-prets"
        title="Avances & prêts"
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <Wallet size={16} />
        <span className="hidden sm:inline">Avances &amp; prêts</span>
      </Link>
    </>
  );
}
