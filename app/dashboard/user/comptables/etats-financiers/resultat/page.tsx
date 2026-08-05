"use client";

// États financiers — Compte de résultat.
// Une des 4 pages consommant /api/comptable/etats-financiers-reels?annee= (voir bilan/page.tsx).
import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import { TrendingUp, Download, Printer } from "lucide-react";
import type { EtatsFinanciersReelsResponse } from "@/lib/comptabilite/etatsFinanciersReelsTypes";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";
import { exportMultiSheetXlsx, type XlsxColumn } from "@/lib/exportXlsx";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COLONNES_CR: XlsxColumn<Record<string, any>>[] = [
  { label: "Compte", key: "compteNumero", width: 12 },
  { label: "Libellé", key: "libelle", width: 40 },
  { label: "Montant", key: "montant", type: "currency" },
];

export default function CompteResultatPage() {
  const [annee, setAnnee] = useState(() => String(new Date().getFullYear()));
  const { data, loading } = useApi<EtatsFinanciersReelsResponse>(`/api/comptable/etats-financiers-reels?annee=${annee}`);
  const cr = data?.data.compteResultat;
  const parPdv = data?.data.resultatParPointDeVente ?? [];

  async function handleExport() {
    if (!cr) return;
    await exportMultiSheetXlsx([
      { sheetName: "Produits", kind: "object", rows: cr.produits, columns: COLONNES_CR, title: `Compte de résultat — Produits ${annee}` },
      { sheetName: "Charges", kind: "object", rows: cr.charges, columns: COLONNES_CR, title: `Compte de résultat — Charges ${annee}` },
    ], `compte-resultat-${annee}.xlsx`);
  }

  return (
    <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="text-emerald-600" size={22} /> Compte de résultat
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">Produits et charges de l&apos;exercice, dérivés des écritures validées (CDC §37).</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="number" value={annee} onChange={(e) => setAnnee(e.target.value)}
            className="w-24 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 [appearance:textfield]" />
          <button onClick={handleExport} disabled={!cr}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <Download size={14} /> Excel
          </button>
          <a href={`/api/comptable/etats-financiers/resultat/pdf?annee=${annee}`} download
            aria-disabled={!cr}
            className={`flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 ${!cr ? "pointer-events-none opacity-50" : ""}`}>
            <Printer size={14} /> PDF
          </a>
          {AIDE_COMPTABLE.etatsReels && <AideComptable contenu={AIDE_COMPTABLE.etatsReels} />}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12"><div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /></div>
      ) : cr && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 max-w-2xl">
          <h4 className="font-semibold text-slate-800 mb-3">Compte de résultat {annee}</h4>
          <div className="space-y-1 text-sm mb-2">
            <p className="text-xs font-semibold text-emerald-600 uppercase">Produits</p>
            {cr.produits.map((l) => (
              <div key={l.compteNumero} className="flex justify-between"><span className="text-slate-600 font-mono text-xs">{l.compteNumero} {l.libelle}</span><span className="text-emerald-700">{formatCurrency(l.montant)}</span></div>
            ))}
            {cr.produits.length === 0 && <p className="text-slate-400 text-xs italic">Aucun produit</p>}
            <p className="text-xs font-semibold text-red-600 uppercase mt-2">Charges</p>
            {cr.charges.map((l) => (
              <div key={l.compteNumero} className="flex justify-between"><span className="text-slate-600 font-mono text-xs">{l.compteNumero} {l.libelle}</span><span className="text-red-600">{formatCurrency(l.montant)}</span></div>
            ))}
            {cr.charges.length === 0 && <p className="text-slate-400 text-xs italic">Aucune charge</p>}
          </div>
          <div className={`flex justify-between mt-3 pt-3 border-t border-slate-200 font-bold ${cr.resultatNet >= 0 ? "text-emerald-700" : "text-red-600"}`}>
            <span>Résultat net</span><span>{formatCurrency(cr.resultatNet)}</span>
          </div>
        </div>
      )}

      {/* Niveaux de résultat SYSCOHADA (CDC §37) */}
      {cr && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 max-w-2xl">
          <h4 className="font-semibold text-slate-800 mb-3">Résultats intermédiaires SYSCOHADA</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">Résultat d&apos;exploitation</span><span className={`font-semibold ${cr.exploitation.resultat >= 0 ? "text-emerald-700" : "text-red-600"}`}>{formatCurrency(cr.exploitation.resultat)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Résultat financier</span><span className={`font-semibold ${cr.financier.resultat >= 0 ? "text-emerald-700" : "text-red-600"}`}>{formatCurrency(cr.financier.resultat)}</span></div>
            <div className="flex justify-between pt-2 border-t border-slate-100"><span className="font-medium text-slate-700">= Résultat des activités ordinaires</span><span className={`font-bold ${cr.resultatActivitesOrdinaires >= 0 ? "text-emerald-700" : "text-red-600"}`}>{formatCurrency(cr.resultatActivitesOrdinaires)}</span></div>
            {Math.abs(cr.hao.resultat) > 0.01 && (
              <div className="flex justify-between"><span className="text-slate-600">Résultat hors activités ordinaires (HAO)</span><span className={`font-semibold ${cr.hao.resultat >= 0 ? "text-emerald-700" : "text-red-600"}`}>{formatCurrency(cr.hao.resultat)}</span></div>
            )}
            {cr.impotsSurResultat > 0.01 && (
              <div className="flex justify-between"><span className="text-slate-600">Impôts sur le résultat</span><span className="font-semibold text-red-600">-{formatCurrency(cr.impotsSurResultat)}</span></div>
            )}
            <div className={`flex justify-between pt-2 border-t-2 border-slate-200 font-bold ${cr.resultatNet >= 0 ? "text-emerald-700" : "text-red-600"}`}>
              <span>= Résultat net</span><span>{formatCurrency(cr.resultatNet)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Résultat par point de vente (CDC §48) */}
      {parPdv.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 max-w-2xl">
          <h4 className="font-semibold text-slate-800 mb-1">Résultat par point de vente</h4>
          <p className="text-xs text-slate-500 mb-3">Produits/charges de l&apos;exercice ventilés par PDV (écritures portant un pointDeVenteId).</p>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100"><tr>
              <th className="text-left py-1.5 pr-3 text-slate-500 text-xs uppercase">Point de vente</th>
              <th className="text-right py-1.5 px-3 text-slate-500 text-xs uppercase">Produits</th>
              <th className="text-right py-1.5 px-3 text-slate-500 text-xs uppercase">Charges</th>
              <th className="text-right py-1.5 pl-3 text-slate-500 text-xs uppercase">Résultat</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {parPdv.map((p) => (
                <tr key={p.pointDeVenteId ?? "NULL"}>
                  <td className="py-1.5 pr-3 text-slate-700">{p.nom}</td>
                  <td className="py-1.5 px-3 text-right text-emerald-700">{formatCurrency(p.produits)}</td>
                  <td className="py-1.5 px-3 text-right text-red-600">{formatCurrency(p.charges)}</td>
                  <td className={`py-1.5 pl-3 text-right font-semibold ${p.resultat >= 0 ? "text-emerald-700" : "text-red-600"}`}>{formatCurrency(p.resultat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
