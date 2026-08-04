"use client";

// Grand livre (CDC Comptabilité §34) — mouvements d'UN compte réel du plan
// comptable, solde progressif, dérivés exclusivement des écritures
// (lib/comptabilite/grandLivreBalance.ts). Remplace l'ancienne page qui
// regroupait des opérations métier (VersementPack, OperationCaisse…) par
// "catégorie", sans aucun lien avec le plan comptable SYSCOHADA réel.

import { useMemo, useState } from "react";
import { BookOpen, Search, Download, Printer } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { exportToXlsx } from "@/lib/exportXlsx";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";

interface CompteEntry { id: number; numero: string; libelle: string }
interface ComptesResponse { data: CompteEntry[] }
interface LigneGrandLivre {
  id: number; date: string; numeroPiece: string; journal: string; libelle: string;
  debit: number; credit: number; lettrage: string | null; solde: number; utilisateur: string | null;
}
interface GrandLivreResponse {
  data: { compte: { numero: string; libelle: string } | null; soldeOuverture: number; lignes: LigneGrandLivre[]; soldeFinal: number };
}

function telechargerCsv(nom: string, lignes: LigneGrandLivre[]) {
  const entetes = ["Date", "N° pièce", "Journal", "Libellé", "Débit", "Crédit", "Solde"];
  const rows = lignes.map((l) => [
    formatDateShort(l.date), l.numeroPiece, l.journal, `"${l.libelle.replace(/"/g, '""')}"`,
    l.debit || "", l.credit || "", l.solde,
  ]);
  const csv = [entetes, ...rows].map((r) => r.join(";")).join("\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nom;
  a.click();
  URL.revokeObjectURL(url);
}

export default function GrandLivrePage() {
  const [rechercheCompte, setRechercheCompte] = useState("");
  const [compteSelectionne, setCompteSelectionne] = useState<CompteEntry | null>(null);
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");

  const { data: comptesData } = useApi<ComptesResponse>(
    rechercheCompte.trim().length >= 2 ? `/api/comptable/plan-comptable?search=${encodeURIComponent(rechercheCompte)}&limit=15` : null,
  );

  const grandLivreUrl = useMemo(() => {
    if (!compteSelectionne) return null;
    const p = new URLSearchParams({ compteId: String(compteSelectionne.id) });
    if (dateDebut) p.set("dateDebut", dateDebut);
    if (dateFin) p.set("dateFin", dateFin);
    return `/api/comptable/etats-financiers/grand-livre?${p.toString()}`;
  }, [compteSelectionne, dateDebut, dateFin]);

  const { data: grandLivreData, loading: grandLivreLoading } = useApi<GrandLivreResponse>(grandLivreUrl);
  const gl = grandLivreData?.data;

  function handleExporterExcel() {
    if (!gl || !compteSelectionne) return;
    exportToXlsx(
      gl.lignes.map((l) => ({ date: l.date.slice(0, 10), piece: l.numeroPiece, journal: l.journal, libelle: l.libelle, debit: l.debit, credit: l.credit, solde: l.solde })),
      [
        { label: "Date", key: "date" }, { label: "N° pièce", key: "piece" }, { label: "Journal", key: "journal" },
        { label: "Libellé", key: "libelle" },
        { label: "Débit", key: "debit", type: "currency", format: (v) => Number(v) },
        { label: "Crédit", key: "credit", type: "currency", format: (v) => Number(v) },
        { label: "Solde", key: "solde", type: "currency", format: (v) => Number(v) },
      ],
      `grand-livre-${compteSelectionne.numero}.xlsx`,
      { sheetName: `Compte ${compteSelectionne.numero}` },
    );
  }

  return (
    <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5 print:px-0">
      <div className="flex items-center justify-between flex-wrap gap-4 print:hidden">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <BookOpen className="text-emerald-600" size={22} /> Grand livre
        </h2>
        {AIDE_COMPTABLE.grandlivre && <AideComptable contenu={AIDE_COMPTABLE.grandlivre} />}
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={compteSelectionne ? `${compteSelectionne.numero} — ${compteSelectionne.libelle}` : rechercheCompte}
              onChange={(e) => { setCompteSelectionne(null); setRechercheCompte(e.target.value); }}
              placeholder="Rechercher un compte (n° ou libellé)…"
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            {!compteSelectionne && (comptesData?.data.length ?? 0) > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                {comptesData!.data.map((c) => (
                  <button key={c.id} onClick={() => { setCompteSelectionne(c); setRechercheCompte(""); }}
                    className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-sm border-b border-slate-50 last:border-0">
                    <span className="font-mono font-bold text-emerald-700">{c.numero}</span> <span className="text-slate-600">{c.libelle}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <span className="text-slate-400 text-xs">→</span>
            <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button onClick={() => gl && compteSelectionne && telechargerCsv(`grand-livre-${compteSelectionne.numero}.csv`, gl.lignes)}
              disabled={!gl} className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              <Download size={14} /> CSV
            </button>
            <button onClick={handleExporterExcel} disabled={!gl}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              <Download size={14} /> Excel
            </button>
            <button onClick={() => window.print()} disabled={!gl}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40">
              <Printer size={14} /> PDF
            </button>
          </div>
        </div>
      </div>

      {!compteSelectionne ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400 shadow-sm border border-slate-200/60 print:hidden">
          Recherchez et sélectionnez un compte pour afficher son grand livre.
        </div>
      ) : grandLivreLoading ? (
        <div className="p-16 text-center"><div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto" /></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden print:border-0 print:shadow-none">
          <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 print:bg-white">
            <span className="font-mono font-bold text-emerald-700">{gl?.compte?.numero}</span>{" "}
            <span className="font-bold text-slate-800">{gl?.compte?.libelle}</span>
            {dateDebut && <span className="text-xs text-slate-400 ml-2">Solde d&apos;ouverture : {formatCurrency(gl?.soldeOuverture ?? 0)}</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">N° pièce</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Libellé</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">Débit</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">Crédit</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">Solde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(gl?.lignes ?? []).map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{formatDateShort(l.date)}</td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{l.numeroPiece}</td>
                    <td className="px-4 py-2 text-slate-700 max-w-xs truncate" title={l.libelle}>{l.libelle}</td>
                    <td className="px-4 py-2 text-right text-blue-700">{l.debit > 0 ? formatCurrency(l.debit) : <span className="text-slate-200">—</span>}</td>
                    <td className="px-4 py-2 text-right text-emerald-700">{l.credit > 0 ? formatCurrency(l.credit) : <span className="text-slate-200">—</span>}</td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-800">{formatCurrency(l.solde)}</td>
                  </tr>
                ))}
                {(gl?.lignes ?? []).length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Aucun mouvement pour ce compte sur la période.</td></tr>
                )}
              </tbody>
              {gl && gl.lignes.length > 0 && (
                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right font-bold text-slate-700">Solde final</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(gl.soldeFinal)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
