"use client";

import { useApi } from "@/hooks/useApi";

interface PortefeuilleOpt {
  id: number; reference: string; nom: string | null;
  capitalDisponible: string | number;
  profilRIA?: { gestionnaire?: { member?: { nom: string; prenom: string } | null } | null } | null;
}

const fmt = (n: string | number) => Number(n || 0).toLocaleString("fr-FR");

/**
 * Sélecteur de portefeuille RIA (avec capital disponible affiché).
 * `apiBase` : "/api/admin/ria/portefeuilles" (admin) ou "/api/membreCommission/portefeuilles" (membre).
 * `montantRequis` : si fourni, signale les portefeuilles au capital insuffisant.
 */
export function PortefeuilleSelect({ apiBase, value, onChange, montantRequis }: {
  apiBase: string;
  value: string;
  onChange: (id: string) => void;
  montantRequis?: number;
}) {
  const { data } = useApi<{ data: PortefeuilleOpt[] }>(`${apiBase}?limit=100&actif=true`);
  const portefeuilles = data?.data ?? [];
  const selected = portefeuilles.find((p) => String(p.id) === value);
  const insuffisant = !!selected && montantRequis !== undefined && Number(selected.capitalDisponible) < montantRequis;

  const label = (p: PortefeuilleOpt) => {
    const m = p.profilRIA?.gestionnaire?.member;
    const inv = m ? `${m.prenom} ${m.nom}` : "—";
    return `${p.reference}${p.nom ? ` · ${p.nom}` : ""} (${inv}) — dispo ${fmt(p.capitalDisponible)} F`;
  };

  return (
    <div>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
        <option value="">— Choisir un portefeuille —</option>
        {portefeuilles.map((p) => <option key={p.id} value={p.id}>{label(p)}</option>)}
      </select>
      {portefeuilles.length === 0 && (
        <p className="text-xs text-amber-600 mt-1">Aucun portefeuille disponible — créez d&apos;abord un investisseur avec portefeuille.</p>
      )}
      {insuffisant && (
        <p className="text-xs text-rose-600 mt-1">
          Capital disponible ({fmt(selected!.capitalDisponible)} F) insuffisant pour le montant requis ({fmt(montantRequis!)} F) — le décaissement échouera.
        </p>
      )}
    </div>
  );
}
