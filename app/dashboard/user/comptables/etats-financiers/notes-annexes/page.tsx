"use client";

// États financiers — Notes annexes.
// Une des 4 pages consommant /api/comptable/etats-financiers-reels?annee= (voir bilan/page.tsx).
// Contrairement à l'ancien bloc du monolithe (résumé sommaire), affiche l'intégralité
// des notes enrichies calculées par lib/comptabilite/etatsFinanciers.ts::genererNotesAnnexes :
// immobilisations par catégorie (mouvements de la période), échéancier créances/dettes par
// tranche d'ancienneté, mouvements de provisions par type, CCA/PCA en cours et leur solde
// restant à étaler, et variation des capitaux propres (CDC §39).
import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import { FileText } from "lucide-react";
import type { EtatsFinanciersReelsResponse } from "@/lib/comptabilite/etatsFinanciersReelsTypes";
import { CATEGORIE_IMMO_LABELS } from "@/lib/comptabilite/etatsFinanciersReelsTypes";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";

const TYPE_PROVISION_LABELS: Record<string, string> = {
  PROVISION_RISQUE_CHARGE: "Provision pour risques et charges",
  DEPRECIATION_STOCK: "Dépréciation de stock",
  DEPRECIATION_CLIENT: "Dépréciation de créance client",
  DEPRECIATION_IMMOBILISATION: "Dépréciation d'immobilisation",
};
const TYPE_REGUL_LABELS: Record<string, string> = {
  CHARGE_CONSTATEE_AVANCE: "CCA",
  PRODUIT_CONSTATE_AVANCE: "PCA",
};

export default function NotesAnnexesPage() {
  const [annee, setAnnee] = useState(() => String(new Date().getFullYear()));
  const { data, loading } = useApi<EtatsFinanciersReelsResponse>(`/api/comptable/etats-financiers-reels?annee=${annee}`);
  const notes = data?.data.notesAnnexes;

  return (
    <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="text-emerald-600" size={22} /> Notes annexes
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">Détails structurés dérivés des écritures/immobilisations/provisions/régularisations (CDC §39).</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="number" value={annee} onChange={(e) => setAnnee(e.target.value)}
            className="w-24 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 [appearance:textfield]" />
          {AIDE_COMPTABLE.etatsReels && <AideComptable contenu={AIDE_COMPTABLE.etatsReels} />}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12"><div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /></div>
      ) : notes && (
        <div className="space-y-5">
          {/* Synthèse rapide */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
            <h4 className="font-semibold text-slate-800 mb-3">Synthèse {annee}</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-slate-400">Immobilisations (net)</p><p className="font-semibold text-slate-800">{formatCurrency(notes.immobilisations.net)}</p></div>
              <div><p className="text-xs text-slate-400">Amort. cumulé</p><p className="font-semibold text-amber-700">{formatCurrency(notes.immobilisations.amortissementCumule)}</p></div>
              <div><p className="text-xs text-slate-400">Stocks</p><p className="font-semibold text-slate-800">{formatCurrency(notes.stocks)}</p></div>
              <div><p className="text-xs text-slate-400">Créances (41x)</p><p className="font-semibold text-blue-700">{formatCurrency(notes.creances.total)}</p></div>
              <div><p className="text-xs text-slate-400">Dettes (40x)</p><p className="font-semibold text-red-600">{formatCurrency(notes.dettes.total)}</p></div>
              <div><p className="text-xs text-slate-400">Trésorerie</p><p className="font-semibold text-emerald-700">{formatCurrency(notes.tresorerie)}</p></div>
              <div><p className="text-xs text-slate-400">Capitaux propres</p><p className="font-semibold text-slate-800">{formatCurrency(notes.capitauxPropres)}</p></div>
              <div><p className="text-xs text-slate-400">Charges / Produits</p><p className="font-semibold text-slate-800">{formatCurrency(notes.charges)} / {formatCurrency(notes.produits)}</p></div>
              <div><p className="text-xs text-slate-400">Effectifs</p><p className="font-semibold text-slate-800">{notes.effectifs.total} collaborateur(s)</p></div>
            </div>
          </div>

          {/* Effectifs par département */}
          {notes.effectifs.parDepartement.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <h4 className="font-semibold text-slate-800 mb-3">Effectifs par département — à ce jour</h4>
              <div className="flex flex-wrap gap-2">
                {notes.effectifs.parDepartement.map((e) => (
                  <span key={e.departement} className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full font-medium">
                    {e.departement} — <strong>{e.effectif}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Immobilisations par catégorie */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
            <h4 className="font-semibold text-slate-800 mb-3">Immobilisations par catégorie — mouvements de la période</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-slate-100"><tr>
                  <th className="text-left py-1.5 pr-3 text-slate-500">Catégorie</th>
                  <th className="text-right py-1.5 px-3 text-slate-500">Brut début</th>
                  <th className="text-right py-1.5 px-3 text-slate-500">Acquisitions</th>
                  <th className="text-right py-1.5 px-3 text-slate-500">Cessions</th>
                  <th className="text-right py-1.5 px-3 text-slate-500">Brut fin</th>
                  <th className="text-right py-1.5 px-3 text-amber-600">Amort. cumulé</th>
                  <th className="text-right py-1.5 pl-3 text-emerald-600">Net</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {notes.immobilisations.parCategorie.map((c) => (
                    <tr key={c.categorie}>
                      <td className="py-1.5 pr-3 text-slate-700">{CATEGORIE_IMMO_LABELS[c.categorie] ?? c.categorie}</td>
                      <td className="py-1.5 px-3 text-right text-slate-600">{formatCurrency(c.brutDebut)}</td>
                      <td className="py-1.5 px-3 text-right text-slate-600">{formatCurrency(c.acquisitionsPeriode)}</td>
                      <td className="py-1.5 px-3 text-right text-slate-600">{formatCurrency(c.cessionsPeriode)}</td>
                      <td className="py-1.5 px-3 text-right text-slate-700 font-medium">{formatCurrency(c.brutFin)}</td>
                      <td className="py-1.5 px-3 text-right text-amber-700">{formatCurrency(c.amortissementCumule)}</td>
                      <td className="py-1.5 pl-3 text-right text-emerald-700 font-semibold">{formatCurrency(c.net)}</td>
                    </tr>
                  ))}
                  {notes.immobilisations.parCategorie.length === 0 && (
                    <tr><td colSpan={7} className="py-6 text-center text-slate-400">Aucune immobilisation.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Échéancier créances / dettes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <h4 className="font-semibold text-slate-800 mb-3">Échéancier créances clients (411)</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-slate-100"><tr>
                    <th className="text-left py-1.5 pr-2 text-slate-500">Client</th>
                    <th className="text-right py-1.5 px-2 text-slate-500">0-30j</th>
                    <th className="text-right py-1.5 px-2 text-slate-500">31-60j</th>
                    <th className="text-right py-1.5 px-2 text-slate-500">61-90j</th>
                    <th className="text-right py-1.5 pl-2 text-red-600">90j+</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {notes.creances.echeancier.map((l) => (
                      <tr key={l.tiersId}>
                        <td className="py-1.5 pr-2 text-slate-700">{l.tiersNom}</td>
                        <td className="py-1.5 px-2 text-right text-slate-600">{l.tranche0_30 !== 0 ? formatCurrency(l.tranche0_30) : "—"}</td>
                        <td className="py-1.5 px-2 text-right text-amber-600">{l.tranche31_60 !== 0 ? formatCurrency(l.tranche31_60) : "—"}</td>
                        <td className="py-1.5 px-2 text-right text-orange-600">{l.tranche61_90 !== 0 ? formatCurrency(l.tranche61_90) : "—"}</td>
                        <td className="py-1.5 pl-2 text-right text-red-600 font-medium">{l.tranche90Plus !== 0 ? formatCurrency(l.tranche90Plus) : "—"}</td>
                      </tr>
                    ))}
                    {notes.creances.echeancier.length === 0 && (
                      <tr><td colSpan={5} className="py-6 text-center text-slate-400">Aucune créance en cours.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <h4 className="font-semibold text-slate-800 mb-3">Échéancier dettes fournisseurs (401)</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-slate-100"><tr>
                    <th className="text-left py-1.5 pr-2 text-slate-500">Fournisseur</th>
                    <th className="text-right py-1.5 px-2 text-slate-500">0-30j</th>
                    <th className="text-right py-1.5 px-2 text-slate-500">31-60j</th>
                    <th className="text-right py-1.5 px-2 text-slate-500">61-90j</th>
                    <th className="text-right py-1.5 pl-2 text-red-600">90j+</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {notes.dettes.echeancier.map((l) => (
                      <tr key={l.tiersId}>
                        <td className="py-1.5 pr-2 text-slate-700">{l.tiersNom}</td>
                        <td className="py-1.5 px-2 text-right text-slate-600">{l.tranche0_30 !== 0 ? formatCurrency(l.tranche0_30) : "—"}</td>
                        <td className="py-1.5 px-2 text-right text-amber-600">{l.tranche31_60 !== 0 ? formatCurrency(l.tranche31_60) : "—"}</td>
                        <td className="py-1.5 px-2 text-right text-orange-600">{l.tranche61_90 !== 0 ? formatCurrency(l.tranche61_90) : "—"}</td>
                        <td className="py-1.5 pl-2 text-right text-red-600 font-medium">{l.tranche90Plus !== 0 ? formatCurrency(l.tranche90Plus) : "—"}</td>
                      </tr>
                    ))}
                    {notes.dettes.echeancier.length === 0 && (
                      <tr><td colSpan={5} className="py-6 text-center text-slate-400">Aucune dette en cours.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Provisions & CCA/PCA */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <h4 className="font-semibold text-slate-800 mb-3">Mouvements de provisions de la période</h4>
              <table className="w-full text-xs">
                <thead className="border-b border-slate-100"><tr>
                  <th className="text-left py-1.5 pr-2 text-slate-500">Type</th>
                  <th className="text-right py-1.5 px-2 text-indigo-600">Dotations</th>
                  <th className="text-right py-1.5 pl-2 text-amber-600">Reprises</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {notes.provisions.map((p) => (
                    <tr key={p.type}>
                      <td className="py-1.5 pr-2 text-slate-700">{TYPE_PROVISION_LABELS[p.type] ?? p.type}</td>
                      <td className="py-1.5 px-2 text-right text-indigo-700">{formatCurrency(p.dotations)}</td>
                      <td className="py-1.5 pl-2 text-right text-amber-700">{formatCurrency(p.reprises)}</td>
                    </tr>
                  ))}
                  {notes.provisions.length === 0 && (
                    <tr><td colSpan={3} className="py-6 text-center text-slate-400">Aucun mouvement sur la période.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
              <h4 className="font-semibold text-slate-800 mb-3">Charges/produits constatés d&apos;avance en cours</h4>
              <table className="w-full text-xs">
                <thead className="border-b border-slate-100"><tr>
                  <th className="text-left py-1.5 pr-2 text-slate-500">Libellé</th>
                  <th className="text-left py-1.5 px-2 text-slate-500">Type</th>
                  <th className="text-right py-1.5 pl-2 text-slate-500">Solde restant</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {notes.chargesProduitsConstatesAvance.map((r) => (
                    <tr key={r.id}>
                      <td className="py-1.5 pr-2 text-slate-700">{r.libelle}</td>
                      <td className="py-1.5 px-2 text-slate-500">{TYPE_REGUL_LABELS[r.type] ?? r.type}</td>
                      <td className="py-1.5 pl-2 text-right text-amber-700 font-medium">{formatCurrency(r.soldeRestant)}</td>
                    </tr>
                  ))}
                  {notes.chargesProduitsConstatesAvance.length === 0 && (
                    <tr><td colSpan={3} className="py-6 text-center text-slate-400">Aucune régularisation active.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Variation des capitaux propres */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 max-w-xl">
            <h4 className="font-semibold text-slate-800 mb-3">Variation des capitaux propres — {annee}</h4>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Résultat net de la période</span><span className={`font-semibold ${notes.resultatNetPeriode >= 0 ? "text-emerald-700" : "text-red-600"}`}>{formatCurrency(notes.resultatNetPeriode)}</span></div>
              <div className="flex justify-between pt-1.5 border-t border-slate-100"><span className="text-slate-500">Variation nette des capitaux propres (classe 1)</span><span className={`font-semibold ${notes.variationCapitauxPropres >= 0 ? "text-emerald-700" : "text-red-600"}`}>{formatCurrency(notes.variationCapitauxPropres)}</span></div>
              <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold text-slate-800"><span>Capitaux propres en fin de période</span><span>{formatCurrency(notes.capitauxPropres)}</span></div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
