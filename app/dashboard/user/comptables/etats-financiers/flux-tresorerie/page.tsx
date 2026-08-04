"use client";

// États financiers — Tableau des flux de trésorerie.
// Une des 4 pages consommant /api/comptable/etats-financiers-reels?annee= (voir bilan/page.tsx).
import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import { Wallet } from "lucide-react";
import type { EtatsFinanciersReelsResponse } from "@/lib/comptabilite/etatsFinanciersReelsTypes";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";

const JOURNAL_LABELS: Record<string, string> = {
  CAISSE: "Caisse", BANQUE: "Banque", VENTES: "Ventes",
  ACHATS: "Achats", OD: "Opérations diverses", PAIE: "Paie",
};

export default function FluxTresoreriePage() {
  const [annee, setAnnee] = useState(() => String(new Date().getFullYear()));
  const { data, loading } = useApi<EtatsFinanciersReelsResponse>(`/api/comptable/etats-financiers-reels?annee=${annee}`);
  const flux = data?.data.tableauFlux;

  return (
    <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Wallet className="text-emerald-600" size={22} /> Tableau des flux de trésorerie
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">Mouvements nets des comptes de trésorerie sur l&apos;exercice, ventilés par journal (CDC §38).</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="number" value={annee} onChange={(e) => setAnnee(e.target.value)}
            className="w-24 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 [appearance:textfield]" />
          {AIDE_COMPTABLE.etatsReels && <AideComptable contenu={AIDE_COMPTABLE.etatsReels} />}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12"><div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /></div>
      ) : flux && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 max-w-2xl">
          <h4 className="font-semibold text-slate-800 mb-3">Tableau des flux de trésorerie {annee}</h4>
          <div className="grid grid-cols-2 gap-3 text-sm mb-3">
            <div className="p-3 bg-emerald-50 rounded-xl"><p className="text-xs text-emerald-600">Encaissements</p><p className="font-bold text-emerald-700">{formatCurrency(flux.encaissements)}</p></div>
            <div className="p-3 bg-red-50 rounded-xl"><p className="text-xs text-red-600">Décaissements</p><p className="font-bold text-red-600">{formatCurrency(flux.decaissements)}</p></div>
          </div>
          <div className="flex justify-between pt-3 border-t border-slate-200 font-bold text-slate-800 mb-3">
            <span>Flux net de trésorerie</span><span>{formatCurrency(flux.fluxNet)}</span>
          </div>
          <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Par journal</p>
          {Object.entries(flux.parJournal).map(([j, m]) => (
            <div key={j} className="flex justify-between text-xs text-slate-600"><span>{JOURNAL_LABELS[j] ?? j}</span><span>{formatCurrency(m)}</span></div>
          ))}
          {Object.keys(flux.parJournal).length === 0 && <p className="text-slate-400 text-xs italic">Aucun mouvement de trésorerie.</p>}
        </div>
      )}
    </main>
  );
}
