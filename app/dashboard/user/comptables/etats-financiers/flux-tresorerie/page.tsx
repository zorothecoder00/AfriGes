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
          <p className="text-slate-500 text-sm mt-0.5">Méthode indirecte — résultat retraité en flux exploitation/investissement/financement (CDC §38).</p>
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
        <div className="space-y-5 max-w-3xl">
          {/* Flux d'exploitation */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
            <h4 className="font-semibold text-slate-800 mb-3">Flux de trésorerie liés à l&apos;activité opérationnelle</h4>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Résultat net de la période</span><span className="font-medium text-slate-800">{formatCurrency(flux.resultatNet)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">+ Dotations aux amort./provisions</span><span className="font-medium text-slate-800">{formatCurrency(flux.dotationsAmortissementsProvisions)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">− Reprises d&apos;amort./provisions</span><span className="font-medium text-slate-800">{formatCurrency(flux.reprisesAmortissementsProvisions)}</span></div>
              <div className="flex justify-between pt-1.5 border-t border-slate-100 font-semibold"><span className="text-slate-700">= Capacité d&apos;autofinancement globale (CAFG)</span><span className="text-slate-800">{formatCurrency(flux.cafg)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">− Variation stocks</span><span className="font-medium text-slate-800">{formatCurrency(flux.variationBFR.stocks)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">− Variation créances (41x)</span><span className="font-medium text-slate-800">{formatCurrency(flux.variationBFR.creances)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">+ Variation dettes fournisseurs (40x)</span><span className="font-medium text-slate-800">{formatCurrency(flux.variationBFR.dettesFournisseurs)}</span></div>
              <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold text-emerald-700"><span>Flux net d&apos;exploitation</span><span>{formatCurrency(flux.fluxActiviteOperationnelle)}</span></div>
            </div>
          </div>

          {/* Flux d'investissement */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
            <h4 className="font-semibold text-slate-800 mb-3">Flux de trésorerie liés aux opérations d&apos;investissement</h4>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">− Acquisitions d&apos;immobilisations</span><span className="font-medium text-slate-800">{formatCurrency(flux.investissement.acquisitionsImmobilisations)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">+ Cessions d&apos;immobilisations</span><span className="font-medium text-slate-800">{formatCurrency(flux.investissement.cessionsImmobilisations)}</span></div>
              <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold text-blue-700"><span>Flux net d&apos;investissement</span><span>{formatCurrency(flux.investissement.total)}</span></div>
            </div>
          </div>

          {/* Flux de financement */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
            <h4 className="font-semibold text-slate-800 mb-3">Flux de trésorerie liés aux opérations de financement</h4>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Variation capitaux propres (hors résultat)</span><span className="font-medium text-slate-800">{formatCurrency(flux.financement.variationCapitauxPropres)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Variation emprunts</span><span className="font-medium text-slate-800">{formatCurrency(flux.financement.variationEmprunts)}</span></div>
              <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold text-violet-700"><span>Flux net de financement</span><span>{formatCurrency(flux.financement.total)}</span></div>
            </div>
          </div>

          {/* Synthèse & réconciliation */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
            <h4 className="font-semibold text-slate-800 mb-3">Synthèse {annee}</h4>
            <div className="flex justify-between pt-1.5 font-bold text-slate-800 mb-2"><span>Variation nette de trésorerie (flux calculés)</span><span>{formatCurrency(flux.fluxNetTotal)}</span></div>
            <div className="flex justify-between text-sm text-slate-500 mb-1"><span>Variation réelle de trésorerie (classe 5)</span><span>{formatCurrency(flux.variationTresorerieReelle)}</span></div>
            <div className={`flex justify-between text-xs ${Math.abs(flux.ecartReconciliation) < 1 ? "text-emerald-600" : "text-amber-600"}`}>
              <span>Écart de réconciliation</span><span>{formatCurrency(flux.ecartReconciliation)}</span>
            </div>
          </div>

          {/* Détail encaissements/décaissements par journal */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
            <h4 className="font-semibold text-slate-800 mb-3">Détail des mouvements de trésorerie par journal</h4>
            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
              <div className="p-3 bg-emerald-50 rounded-xl"><p className="text-xs text-emerald-600">Encaissements</p><p className="font-bold text-emerald-700">{formatCurrency(flux.encaissements)}</p></div>
              <div className="p-3 bg-red-50 rounded-xl"><p className="text-xs text-red-600">Décaissements</p><p className="font-bold text-red-600">{formatCurrency(flux.decaissements)}</p></div>
            </div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Par journal</p>
            {Object.entries(flux.parJournal).map(([j, m]) => (
              <div key={j} className="flex justify-between text-xs text-slate-600"><span>{JOURNAL_LABELS[j] ?? j}</span><span>{formatCurrency(m)}</span></div>
            ))}
            {Object.keys(flux.parJournal).length === 0 && <p className="text-slate-400 text-xs italic">Aucun mouvement de trésorerie.</p>}
          </div>
        </div>
      )}
    </main>
  );
}
