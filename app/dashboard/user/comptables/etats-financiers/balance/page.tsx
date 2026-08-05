"use client";

// Balance générale (CDC Comptabilité §33) — dérivée exclusivement des
// écritures comptables validées/clôturées (EcritureComptable/LigneEcriture/
// CompteComptable), jamais des modules opérationnels. Remplace l'ancienne
// page qui affichait une "balance" reconstituée à partir de VersementPack/
// OperationCaisse sur des numéros de compte inventés (701="Acomptes
// initiaux packs" au lieu du vrai 701 SYSCOHADA "Ventes de marchandises").

import { useMemo, useState } from "react";
import { Calculator, Download, Search, FileDown } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import { exportToXlsx } from "@/lib/exportXlsx";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";

interface LigneBalance {
  compteId: number; numero: string; libelle: string; classe: number;
  soldeInitial: number; mouvementDebit: number; mouvementCredit: number;
  soldeFinalDebiteur: number; soldeFinalCrediteur: number;
}
interface BalanceResponse {
  data: LigneBalance[];
  totaux: { soldeInitial: number; mouvementDebit: number; mouvementCredit: number; soldeFinalDebiteur: number; soldeFinalCrediteur: number };
}
interface JournalEntry { code: string; libelle: string; actif: boolean }
interface SectionEntry { id: number; axe: string; libelle: string }
interface PdvEntry { id: number; nom: string; code: string }

function debutAnnee() { return `${new Date().getFullYear()}-01-01`; }
function aujourdhui() { return new Date().toISOString().slice(0, 10); }

export default function BalancePage() {
  const [dateDebut, setDateDebut] = useState(debutAnnee());
  const [dateFin, setDateFin] = useState(aujourdhui());
  const [classe, setClasse] = useState("");
  const [journal, setJournal] = useState("");
  const [pointDeVenteId, setPointDeVenteId] = useState("");
  const [sectionAnalytiqueId, setSectionAnalytiqueId] = useState("");
  const [tiersType, setTiersType] = useState("");
  const [rechercheCompte, setRechercheCompte] = useState("");

  const { data: journauxData } = useApi<{ data: JournalEntry[] }>("/api/comptable/journaux");
  const { data: sectionsData } = useApi<{ data: SectionEntry[] }>("/api/comptable/analytique/sections");
  const { data: pdvData } = useApi<{ data: PdvEntry[] }>("/api/comptable/points-de-vente");

  const balanceUrl = useMemo(() => {
    const p = new URLSearchParams({ dateDebut, dateFin });
    if (classe) p.set("classe", classe);
    if (journal) p.set("journal", journal);
    if (pointDeVenteId) p.set("pointDeVenteId", pointDeVenteId);
    if (sectionAnalytiqueId) p.set("sectionAnalytiqueId", sectionAnalytiqueId);
    if (tiersType) p.set("tiersType", tiersType);
    return `/api/comptable/etats-financiers/balance?${p.toString()}`;
  }, [dateDebut, dateFin, classe, journal, pointDeVenteId, sectionAnalytiqueId, tiersType]);

  const balancePdfUrl = useMemo(() => balanceUrl.replace("/balance?", "/balance/pdf?"), [balanceUrl]);

  const { data: balanceData, loading: balanceLoading } = useApi<BalanceResponse>(balanceUrl);

  const lignesFiltrees = useMemo(() => {
    const q = rechercheCompte.trim().toLowerCase();
    const lignes = balanceData?.data ?? [];
    if (!q) return lignes;
    return lignes.filter((l) => l.numero.toLowerCase().includes(q) || l.libelle.toLowerCase().includes(q));
  }, [balanceData, rechercheCompte]);

  function handleExporter() {
    exportToXlsx(
      lignesFiltrees.map((l) => ({
        compte: l.numero, libelle: l.libelle,
        soldeInitial: l.soldeInitial, mouvementDebit: l.mouvementDebit, mouvementCredit: l.mouvementCredit,
        soldeFinalDebiteur: l.soldeFinalDebiteur, soldeFinalCrediteur: l.soldeFinalCrediteur,
      })),
      [
        { label: "N° Compte", key: "compte" },
        { label: "Libellé", key: "libelle" },
        { label: "Solde initial", key: "soldeInitial", type: "currency", format: (v) => Number(v) },
        { label: "Mouvement débit", key: "mouvementDebit", type: "currency", format: (v) => Number(v) },
        { label: "Mouvement crédit", key: "mouvementCredit", type: "currency", format: (v) => Number(v) },
        { label: "Solde final débiteur", key: "soldeFinalDebiteur", type: "currency", format: (v) => Number(v) },
        { label: "Solde final créditeur", key: "soldeFinalCrediteur", type: "currency", format: (v) => Number(v) },
      ],
      `balance-generale-${dateDebut}-${dateFin}.xlsx`,
      { sheetName: "Balance" },
    );
  }

  return (
    <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Calculator className="text-emerald-600" size={22} /> Balance générale
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">Dérivée des écritures validées — compte, solde initial, mouvements, solde final.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleExporter} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 text-sm font-medium shadow-sm">
            <Download size={15} />Exporter Excel
          </button>
          <a href={balancePdfUrl} download className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 text-sm font-medium shadow-sm">
            <FileDown size={15} />PDF
          </a>
          {AIDE_COMPTABLE.balance && <AideComptable contenu={AIDE_COMPTABLE.balance} />}
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Du</label>
          <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Au</label>
          <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Classe</label>
          <select value={classe} onChange={(e) => setClasse(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">Toutes</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => <option key={c} value={c}>Classe {c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Journal</label>
          <select value={journal} onChange={(e) => setJournal(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">Tous</option>
            {(journauxData?.data ?? []).filter((j) => j.actif).map((j) => <option key={j.code} value={j.code}>{j.libelle}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Agence / PDV</label>
          <select value={pointDeVenteId} onChange={(e) => setPointDeVenteId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">Toutes</option>
            {(pdvData?.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Analytique</label>
          <select value={sectionAnalytiqueId} onChange={(e) => setSectionAnalytiqueId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">Toutes</option>
            {(sectionsData?.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Tiers</label>
          <select value={tiersType} onChange={(e) => setTiersType(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">Tous comptes</option>
            <option value="CLIENT">Clients (411xxx)</option>
            <option value="FOURNISSEUR">Fournisseurs (401xxx)</option>
          </select>
        </div>
        <div className="col-span-2 md:col-span-4 lg:col-span-7 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={rechercheCompte} onChange={(e) => setRechercheCompte(e.target.value)}
            placeholder="Filtrer par n° de compte ou libellé…"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        {balanceLoading ? (
          <div className="flex items-center justify-center p-12"><div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Compte</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Libellé</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Solde initial</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-blue-600 uppercase">Mvt débit</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-emerald-600 uppercase">Mvt crédit</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Solde final débiteur</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Solde final créditeur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lignesFiltrees.map((l) => (
                  <tr key={l.compteId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-sm font-bold text-emerald-700">{l.numero}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-700">{l.libelle}</td>
                    <td className="px-4 py-2.5 text-right text-sm text-slate-500">{formatCurrency(l.soldeInitial)}</td>
                    <td className="px-4 py-2.5 text-right text-sm text-blue-700">{l.mouvementDebit > 0 ? formatCurrency(l.mouvementDebit) : "—"}</td>
                    <td className="px-4 py-2.5 text-right text-sm text-emerald-700">{l.mouvementCredit > 0 ? formatCurrency(l.mouvementCredit) : "—"}</td>
                    <td className="px-4 py-2.5 text-right text-sm font-semibold text-slate-800">{l.soldeFinalDebiteur > 0 ? formatCurrency(l.soldeFinalDebiteur) : "—"}</td>
                    <td className="px-4 py-2.5 text-right text-sm font-semibold text-slate-800">{l.soldeFinalCrediteur > 0 ? formatCurrency(l.soldeFinalCrediteur) : "—"}</td>
                  </tr>
                ))}
                {lignesFiltrees.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">Aucun mouvement sur la période / les filtres sélectionnés.</td></tr>
                )}
              </tbody>
              {balanceData && (
                <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                  <tr>
                    <td className="px-4 py-3" colSpan={2}><span className="font-bold text-slate-800 uppercase text-sm">Totaux</span></td>
                    <td className="px-4 py-3 text-right font-bold text-slate-700">{formatCurrency(balanceData.totaux.soldeInitial)}</td>
                    <td className="px-4 py-3 text-right font-bold text-blue-700">{formatCurrency(balanceData.totaux.mouvementDebit)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">{formatCurrency(balanceData.totaux.mouvementCredit)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(balanceData.totaux.soldeFinalDebiteur)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(balanceData.totaux.soldeFinalCrediteur)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
