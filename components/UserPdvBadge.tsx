"use client";

import { useSession } from "next-auth/react";
import { useApi } from "@/hooks/useApi";
import { MapPin } from "lucide-react";

interface AffectationResponse {
  pdv: { id: number; nom: string; code: string } | null;
}

/**
 * Badge affiché dans la navbar des dashboards gestionnaires.
 * Affiche les initiales, le nom complet et le PDV d'affectation actif.
 */
export default function UserPdvBadge() {
  const { data: session } = useSession();
  const { data } = useApi<AffectationResponse>("/api/me/affectation");

  const prenom = session?.user?.prenom ?? "";
  const nom    = session?.user?.nom    ?? "";
  const pdv    = data?.pdv;

  if (!prenom && !nom) return null;

  const initiales = `${prenom[0] ?? ""}${nom[0] ?? ""}`.toUpperCase();

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
      {/* Avatar initiales */}
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white font-bold text-xs shrink-0">
        {initiales}
      </div>
      {/* Nom + PDV */}
      <div className="hidden sm:block leading-tight">
        <p className="text-xs font-semibold text-slate-800 whitespace-nowrap">
          {prenom} {nom.toUpperCase()}
        </p>
        {pdv ? (
          <p className="text-[10px] text-slate-500 flex items-center gap-0.5">
            <MapPin size={9} className="shrink-0" />
            {pdv.nom}
          </p>
        ) : (
          <p className="text-[10px] text-slate-400 italic">Aucun PDV</p>
        )}
      </div>
    </div>
  );
}
