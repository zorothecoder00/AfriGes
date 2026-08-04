"use client";

// États financiers — Balance des comptes.
// Extrait du bloc activeTab === "balance" du monolithe (app/dashboard/user/comptables/page.tsx,
// ~ligne 2407). La balance est dérivée de la synthèse comptable (/api/comptable/synthese)
// sur une période glissante — ce sélecteur de période était partagé au niveau de la page
// mère ; il est repris ici localement puisque la page est maintenant autonome.
import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { Calculator, Download, RefreshCw, CheckCircle } from "lucide-react";
import { exportToXlsx } from "@/lib/exportXlsx";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";

type Period = "7" | "30" | "90" | "365";

interface SyntheseResponse {
  success: boolean;
  data: {
    periode: { debut: string; fin: string; jours: number };
    encaissements: {
      cotisations_init: { montant: number; count: number };
      versements_peri: { montant: number; count: number };
      remboursements: { montant: number; count: number };
      ventes_directes: { montant: number; count: number };
      caisse_encaissements: { montant: number; count: number };
      autres: { montant: number; count: number };
      total: number;
    };
    decaissements: {
      approvisionnements: { montant: number; count: number };
      salaires: { montant: number; count: number };
      avances: { montant: number; count: number };
      fournisseurs: { montant: number; count: number };
      autres_caisse: { montant: number; count: number };
      total: number;
    };
    resultat_net: number;
  };
}

export default function BalancePage() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("30");
  const { data: synthData, refetch: refetchSynth } = useApi<SyntheseResponse>(`/api/comptable/synthese?period=${selectedPeriod}`);
  const sd = synthData?.data;
  const enc = sd?.encaissements;
  const dec = sd?.decaissements;

  return (
    <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Calculator className="text-emerald-600" size={22} /> Balance des comptes
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Période : {sd ? formatDateShort(sd.periode.debut) : "…"} → {sd ? formatDateShort(sd.periode.fin) : "…"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
            {(["7", "30", "90", "365"] as Period[]).map((p) => (
              <button key={p} onClick={() => setSelectedPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  selectedPeriod === p ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-800"
                }`}>
                {p === "365" ? "1 an" : `${p}j`}
              </button>
            ))}
          </div>
          <button onClick={refetchSynth} className="p-2 bg-white border border-slate-200 shadow-sm text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
            <RefreshCw size={18} />
          </button>
          {AIDE_COMPTABLE.balance && <AideComptable contenu={AIDE_COMPTABLE.balance} />}
        </div>
      </div>

      <div className="space-y-5">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Calculator size={20} className="text-emerald-600" />
              Balance Comptable — Période {selectedPeriod === "365" ? "1 an" : `${selectedPeriod} jours`}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {sd ? `${formatDateShort(sd.periode.debut)} → ${formatDateShort(sd.periode.fin)}` : "…"}
              &nbsp;·&nbsp;Comptes SYSCOHADA simplifiés
            </p>
          </div>
          <button
            onClick={() => {
              const rows = [
                { compte: "701", libelle: "Acomptes initiaux packs",               debit: 0,                                       credit: enc?.cotisations_init.montant ?? 0 },
                { compte: "702", libelle: "Versements périodiques",                debit: 0,                                       credit: enc?.versements_peri.montant ?? 0 },
                { compte: "703", libelle: "Remboursements packs",                  debit: 0,                                       credit: enc?.remboursements.montant ?? 0 },
                { compte: "705", libelle: "Ventes directes de marchandises",       debit: 0,                                       credit: enc?.ventes_directes.montant ?? 0 },
                { compte: "706", libelle: "Encaissements caisse — produits divers", debit: 0,                                      credit: enc?.caisse_encaissements.montant ?? 0 },
                { compte: "708", libelle: "Bonus / Ajustements",                   debit: 0,                                       credit: enc?.autres.montant ?? 0 },
                { compte: "601", libelle: "Approvisionnements — achats stock",    debit: dec?.approvisionnements.montant ?? 0,    credit: 0 },
                { compte: "641", libelle: "Salaires et traitements",              debit: dec?.salaires.montant ?? 0,              credit: 0 },
                { compte: "422", libelle: "Avances au personnel",                 debit: dec?.avances.montant ?? 0,               credit: 0 },
                { compte: "604", libelle: "Paiements fournisseurs",               debit: dec?.fournisseurs.montant ?? 0,          credit: 0 },
                { compte: "658", libelle: "Autres charges diverses",              debit: dec?.autres_caisse.montant ?? 0,         credit: 0 },
              ].filter((r) => r.debit > 0 || r.credit > 0);
              exportToXlsx(rows, [
                { label: "N° Compte", key: "compte" },
                { label: "Libellé", key: "libelle" },
                { label: "Débit", key: "debit", type: "currency", format: (v) => Number(v) },
                { label: "Crédit", key: "credit", type: "currency", format: (v) => Number(v) },
              ], `balance-comptable-${selectedPeriod}j.xlsx`, { sheetName: "Balance" });
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 text-sm font-medium shadow-sm"
          >
            <Download size={15} />Exporter
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-24">N° Compte</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Libellé du compte</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Mouvement Débit</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Mouvement Crédit</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Solde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {([
                { compte: "701", libelle: "Acomptes initiaux (souscriptions packs)",    classe: "Classe 7 — Produits", debit: 0, credit: enc?.cotisations_init.montant ?? 0,     count: enc?.cotisations_init.count },
                { compte: "702", libelle: "Versements périodiques packs",               classe: "Classe 7 — Produits", debit: 0, credit: enc?.versements_peri.montant ?? 0,      count: enc?.versements_peri.count },
                { compte: "703", libelle: "Remboursements packs",                       classe: "Classe 7 — Produits", debit: 0, credit: enc?.remboursements.montant ?? 0,       count: enc?.remboursements.count },
                { compte: "705", libelle: "Ventes directes de marchandises",            classe: "Classe 7 — Produits", debit: 0, credit: enc?.ventes_directes.montant ?? 0,      count: enc?.ventes_directes.count },
                { compte: "706", libelle: "Encaissements caisse — produits divers",    classe: "Classe 7 — Produits", debit: 0, credit: enc?.caisse_encaissements.montant ?? 0, count: enc?.caisse_encaissements.count },
                { compte: "708", libelle: "Bonus / Ajustements",                        classe: "Classe 7 — Produits", debit: 0, credit: enc?.autres.montant ?? 0,               count: enc?.autres.count },
                { compte: "601", libelle: "Approvisionnements — achats stock",         classe: "Classe 6 — Charges",  debit: dec?.approvisionnements.montant ?? 0, credit: 0,                                       count: dec?.approvisionnements.count },
                { compte: "641", libelle: "Salaires et traitements",                   classe: "Classe 6 — Charges",  debit: dec?.salaires.montant ?? 0,           credit: 0,                                       count: dec?.salaires.count },
                { compte: "422", libelle: "Avances au personnel",                      classe: "Classe 4 — Tiers",    debit: dec?.avances.montant ?? 0,            credit: 0,                                       count: dec?.avances.count },
                { compte: "604", libelle: "Paiements fournisseurs",                    classe: "Classe 6 — Charges",  debit: dec?.fournisseurs.montant ?? 0,       credit: 0,                                       count: dec?.fournisseurs.count },
                { compte: "658", libelle: "Autres charges diverses",                   classe: "Classe 6 — Charges",  debit: dec?.autres_caisse.montant ?? 0,      credit: 0,                                       count: dec?.autres_caisse.count },
              ] as { compte: string; libelle: string; classe: string; debit: number; credit: number; count?: number }[])
              .filter((row) => row.debit > 0 || row.credit > 0)
              .map((row) => {
                const solde = row.credit - row.debit;
                return (
                  <tr key={row.compte} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-mono text-sm font-bold text-emerald-700">{row.compte}</td>
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-slate-800">{row.libelle}</p>
                      <p className="text-xs text-slate-400">{row.classe}{row.count !== undefined ? ` — ${row.count} opérations` : ""}</p>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-red-600">
                      {row.debit > 0 ? formatCurrency(row.debit) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-emerald-600">
                      {row.credit > 0 ? formatCurrency(row.credit) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className={`px-5 py-3 text-right font-bold ${solde >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {solde >= 0 ? "+" : ""}{formatCurrency(solde)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-300">
              <tr>
                <td className="px-5 py-4" colSpan={2}>
                  <span className="font-bold text-slate-800 uppercase text-sm">TOTAUX</span>
                </td>
                <td className="px-5 py-4 text-right font-bold text-red-700 text-base">
                  {formatCurrency(dec?.total ?? 0)}
                </td>
                <td className="px-5 py-4 text-right font-bold text-emerald-700 text-base">
                  {formatCurrency(enc?.total ?? 0)}
                </td>
                <td className={`px-5 py-4 text-right font-bold text-base ${(sd?.resultat_net ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {(sd?.resultat_net ?? 0) >= 0 ? "+" : ""}{formatCurrency(sd?.resultat_net ?? 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className={`rounded-2xl p-4 border flex items-start gap-3 ${Math.abs((enc?.total ?? 0) - (dec?.total ?? 0) - (sd?.resultat_net ?? 0)) < 1 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
          <CheckCircle size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Contrôle de cohérence</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Total Produits (Crédit) : <strong>{formatCurrency(enc?.total ?? 0)}</strong>
              &nbsp;·&nbsp;Total Charges (Débit) : <strong>{formatCurrency(dec?.total ?? 0)}</strong>
              &nbsp;·&nbsp;Résultat net : <strong>{formatCurrency(sd?.resultat_net ?? 0)}</strong>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
