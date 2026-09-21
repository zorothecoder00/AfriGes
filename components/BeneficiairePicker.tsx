"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";

/**
 * Sélecteur du membre bénéficiaire d'une sortie de caisse (salaire, avance, carburant…).
 * Le membre choisi est enregistré sur la sortie puis repris automatiquement (nom + téléphone)
 * sur la fiche de décaissement. Facultatif : sans membre, la fiche se remplit à la main.
 */

export interface MembreBeneficiaire {
  id: number; nom: string; prenom: string; telephone: string | null; roleGestionnaire?: string | null;
}

export default function BeneficiairePicker({ value, onChange, className = "" }: {
  value: MembreBeneficiaire | null;
  onChange: (m: MembreBeneficiaire | null) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<MembreBeneficiaire[]>([]);

  async function rechercher(q: string) {
    setQuery(q);
    if (q.trim().length < 2) { setOptions([]); return; }
    try {
      const r = await fetch(`/api/decaissements/beneficiaires?q=${encodeURIComponent(q.trim())}`);
      const j = await r.json();
      if (r.ok) setOptions(j.data);
    } catch { /* recherche non bloquante */ }
  }

  if (value) {
    return (
      <div className={`flex items-center justify-between px-4 py-3 border border-emerald-200 bg-emerald-50 rounded-xl text-sm ${className}`}>
        <span>
          <span className="font-medium text-slate-800">{value.prenom} {value.nom}</span>
          {value.telephone && <span className="text-slate-500"> · {value.telephone}</span>}
        </span>
        <button type="button" onClick={() => onChange(null)} title="Retirer le bénéficiaire"><X size={14} className="text-slate-400" /></button>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={query} onChange={(e) => rechercher(e.target.value)} placeholder="Rechercher un membre (nom, prénom, téléphone)…"
        className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500"
      />
      {options.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {options.map((m) => (
            <button key={m.id} type="button" onClick={() => { onChange(m); setOptions([]); setQuery(""); }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50">
              {m.prenom} {m.nom}
              <span className="text-xs text-slate-400">{m.telephone ? ` · ${m.telephone}` : ""}{m.roleGestionnaire ? ` · ${m.roleGestionnaire}` : ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
