"use client";

import { useSession } from "next-auth/react";
import { useApi } from "@/hooks/useApi";

interface Profil { data: { telephone: string | null; zone: string | null } }

/**
 * Identité de l'agent connecté (nom, zone/secteur, téléphone) affichée en tête des formulaires :
 * le document est créé au nom de l'agent authentifié, sans ressaisie ni modification possible
 * (CDC §4 — formulaire « pré-rempli avec l'identité de l'agent connecté »).
 */
export default function IdentiteAgent() {
  const { data: session } = useSession();
  const { data } = useApi<{ pdv: { nom: string; code: string } | null }>("/api/me/affectation");
  const { data: profil } = useApi<Profil>("/api/me/profile");

  const nom = [session?.user?.prenom, session?.user?.nom].filter(Boolean).join(" ") || session?.user?.name || "—";
  const zone = profil?.data?.zone || (data?.pdv ? `${data.pdv.nom} (${data.pdv.code})` : "—");

  return (
    <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
      <span>Collecteur : <span className="font-semibold text-slate-800">{nom}</span></span>
      <span>Zone/Secteur : <span className="font-semibold text-slate-800">{zone}</span></span>
      <span>Téléphone : <span className="font-semibold text-slate-800">{profil?.data?.telephone || "—"}</span></span>
    </div>
  );
}
