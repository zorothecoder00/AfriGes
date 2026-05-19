"use client";

import { useSession } from "next-auth/react";
import { useApi } from "@/hooks/useApi";
import { useViewAs } from "@/contexts/ViewAsContext";
import { MapPin } from "lucide-react";

interface PDVInfo { id: number; nom: string; code: string }

interface AffectationResponse {
  pdv: PDVInfo | null;
  pdvs: PDVInfo[];
}

/**
 * Badge affiché dans la navbar des dashboards gestionnaires.
 * Affiche les initiales, le nom complet et le(s) PDV d'affectation actif(s).
 * Pour les rôles multi-PDV (CHEF_AGENCE, RESPONSABLE_COMMUNAUTE), tous les PDVs sont affichés.
 */
export default function UserPdvBadge() {
  const { data: session } = useSession();
  const { viewAs } = useViewAs();
  const { data } = useApi<AffectationResponse>("/api/me/affectation");

  // En mode viewAs, afficher les infos du gestionnaire ciblé (pas de l'admin connecté)
  const prenom = viewAs?.prenom ?? session?.user?.prenom ?? "";
  const nom    = viewAs?.nom    ?? session?.user?.nom    ?? "";
  const pdvs   = data?.pdvs ?? (data?.pdv ? [data.pdv] : []);

  if (!prenom && !nom) return null;

  const initiales = `${prenom[0] ?? ""}${nom[0] ?? ""}`.toUpperCase();

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
      {/* Avatar initiales */}
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white font-bold text-xs shrink-0">
        {initiales}
      </div>
      {/* Nom + PDV(s) */}
      <div className="hidden sm:block leading-tight">
        <p className="text-xs font-semibold text-slate-800 whitespace-nowrap">
          {prenom} {nom.toUpperCase()}
        </p>
        {pdvs.length > 0 ? (
          <p className="text-[10px] text-slate-500 flex items-center gap-0.5">
            <MapPin size={9} className="shrink-0" />
            {pdvs.length === 1
              ? pdvs[0].nom
              : pdvs.map((p) => p.nom).join(" · ")
            }
          </p>
        ) : (
          <p className="text-[10px] text-slate-400 italic">Aucun PDV</p>
        )}
      </div>
    </div>
  );
}
