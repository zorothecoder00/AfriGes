"use client";

// États financiers — Bilan.
// Une des 4 pages consommant /api/comptable/etats-financiers-reels?annee=, dérivée
// du bloc activeTab === "etatsReels" du monolithe (~ligne 4630) mais ne conservant
// QUE la section Bilan (Actif/Passif). Compte de résultat, Tableau des flux et
// Notes annexes sont sur leurs propres pages sœurs.
import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import { Landmark, Download, Printer } from "lucide-react";
import type { EtatsFinanciersReelsResponse } from "@/lib/comptabilite/etatsFinanciersReelsTypes";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";
import { exportMultiSheetXlsx, type XlsxColumn } from "@/lib/exportXlsx";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COLONNES_BILAN: XlsxColumn<Record<string, any>>[] = [
  { label: "Compte", key: "compteNumero", width: 12 },
  { label: "Libellé", key: "libelle", width: 40 },
  { label: "Montant", key: "montant", type: "currency" },
];

export default function BilanPage() {
  const [annee, setAnnee] = useState(() => String(new Date().getFullYear()));
  const { data, loading } = useApi<EtatsFinanciersReelsResponse>(`/api/comptable/etats-financiers-reels?annee=${annee}`);
  const bilan = data?.data.bilan;

  async function handleExport() {
    if (!bilan) return;
    await exportMultiSheetXlsx([
      { sheetName: "Actif", kind: "object", rows: bilan.actif, columns: COLONNES_BILAN, title: `Bilan — Actif ${annee}` },
      { sheetName: "Passif", kind: "object", rows: bilan.passif, columns: COLONNES_BILAN, title: `Bilan — Passif ${annee}` },
    ], `bilan-${annee}.xlsx`);
  }

  return (
    <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Landmark className="text-emerald-600" size={22} /> Bilan
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">Dérivé exclusivement des soldes de comptes validés/clôturés (CDC §36).</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="number" value={annee} onChange={(e) => setAnnee(e.target.value)}
            className="w-24 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 [appearance:textfield]" />
          <button onClick={handleExport} disabled={!bilan}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <Download size={14} /> Excel
          </button>
          <a href={`/api/comptable/etats-financiers/bilan/pdf?annee=${annee}`} download
            aria-disabled={!bilan}
            className={`flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 ${!bilan ? "pointer-events-none opacity-50" : ""}`}>
            <Printer size={14} /> PDF
          </a>
          {AIDE_COMPTABLE.etatsReels && <AideComptable contenu={AIDE_COMPTABLE.etatsReels} />}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12"><div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /></div>
      ) : bilan && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-slate-800">Bilan — Actif</h4>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${bilan.equilibre ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                {bilan.equilibre ? "Équilibré" : "Déséquilibré"}
              </span>
            </div>
            <div className="space-y-1 text-sm max-h-96 overflow-y-auto">
              {bilan.actif.map((l) => (
                <div key={l.compteNumero} className="flex justify-between"><span className="text-slate-600 font-mono text-xs">{l.compteNumero} <span className="font-sans text-slate-500">{l.libelle}</span></span><span className="font-medium text-slate-800">{formatCurrency(l.montant)}</span></div>
              ))}
              {bilan.actif.length === 0 && <p className="text-slate-400 text-xs italic">Aucune écriture validée</p>}
            </div>
            <div className="flex justify-between mt-3 pt-3 border-t border-slate-200 font-bold text-slate-800">
              <span>Total Actif</span><span>{formatCurrency(bilan.totalActif)}</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
            <h4 className="font-semibold text-slate-800 mb-3">Bilan — Passif</h4>
            <div className="space-y-1 text-sm max-h-96 overflow-y-auto">
              {bilan.passif.map((l) => (
                <div key={l.compteNumero} className="flex justify-between"><span className="text-slate-600 font-mono text-xs">{l.compteNumero} <span className="font-sans text-slate-500">{l.libelle}</span></span><span className="font-medium text-slate-800">{formatCurrency(l.montant)}</span></div>
              ))}
              {bilan.passif.length === 0 && <p className="text-slate-400 text-xs italic">Aucune écriture validée</p>}
            </div>
            <div className="flex justify-between mt-3 pt-3 border-t border-slate-200 font-bold text-slate-800">
              <span>Total Passif</span><span>{formatCurrency(bilan.totalPassif)}</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
