"use client";

import { useState, useRef } from "react";
import { Percent, PlusCircle, Save, ToggleLeft, ToggleRight } from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";

// ── Types ──────────────────────────────────────────────────────────────────

interface TaxeConfigEntry {
  id: number; code: string; nom: string; taux: number; nature: string;
  compteCollecteNumero: string; compteDeductibleNumero: string | null; compteRegularisationNumero: string | null;
  regimeFiscal: string; applicableAchat: boolean; applicableVente: boolean;
  dateDebut: string | null; dateFin: string | null; actif: boolean;
}

// CDC §21 — "nature" reste une string libre en base (TaxeConfig.nature), mais
// on propose les valeurs usuelles togolaises plutôt qu'un champ toujours figé
// sur "TVA" côté écran (c'était le seul choix possible avant ce formulaire).
const NATURES = ["TVA", "TAXE_LOCALE", "RETENUE_SOURCE", "AUTRE"];
const REGIMES_FISCAUX = [
  { value: "REEL_NORMAL", label: "Réel normal" },
  { value: "REEL_SIMPLIFIE", label: "Réel simplifié" },
  { value: "EXONERE", label: "Exonéré" },
];

const TAXE_VIDE = {
  code: "", nom: "", taux: "", nature: "TVA",
  compteCollecteNumero: "", compteDeductibleNumero: "", compteRegularisationNumero: "",
  regimeFiscal: "REEL_NORMAL", applicableAchat: true, applicableVente: true,
  dateDebut: "", dateFin: "",
};

export default function FiscaliteTaxesPage() {
  const [showAddTaxe, setShowAddTaxe] = useState(false);
  const [newTaxe, setNewTaxe] = useState(TAXE_VIDE);

  // ── Taxes API ────────────────────────────────────────────────────────────
  const { data: taxesData, refetch: refetchTaxes } =
    useApi<{ data: TaxeConfigEntry[] }>("/api/comptable/taxes");
  const { mutate: creerTaxe, loading: creatingTaxe } = useMutation<unknown, object>(
    "/api/comptable/taxes", "POST", { successMessage: "Taxe créée" }
  );
  const taxeActionIdRef = useRef<number | null>(null);
  const { mutate: toggleTaxeApi } = useMutation<unknown, object>(
    () => `/api/comptable/taxes/${taxeActionIdRef.current}`, "PATCH",
  );
  async function handleCreerTaxe() {
    const res = await creerTaxe({
      ...newTaxe,
      taux: Number(newTaxe.taux),
      compteDeductibleNumero: newTaxe.compteDeductibleNumero || null,
      compteRegularisationNumero: newTaxe.compteRegularisationNumero || null,
      dateDebut: newTaxe.dateDebut || null,
      dateFin: newTaxe.dateFin || null,
    });
    if (res) { refetchTaxes(); setShowAddTaxe(false); setNewTaxe(TAXE_VIDE); }
  }
  async function handleToggleTaxe(taxe: TaxeConfigEntry) {
    taxeActionIdRef.current = taxe.id;
    const res = await toggleTaxeApi({ actif: !taxe.actif });
    if (res) refetchTaxes();
  }

  return (
    <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Percent className="text-violet-600" size={22} /> Fiscalité — Taxes
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Aucun taux fiscal n&apos;est codé en dur — tout est paramétré ici et évolue avec la réglementation togolaise (CDC §21).
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {AIDE_COMPTABLE["taxes"] && <AideComptable contenu={AIDE_COMPTABLE["taxes"]} />}
        </div>
      </div>

      {/* Taxes paramétrables */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Percent className="text-violet-600" size={20} /> Taxes paramétrables</h3>
          <button onClick={() => setShowAddTaxe(!showAddTaxe)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700">
            <PlusCircle size={15} /> Nouvelle taxe
          </button>
        </div>
        {showAddTaxe && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <input value={newTaxe.code} onChange={(e) => setNewTaxe(p => ({ ...p, code: e.target.value }))} placeholder="Code (ex: TVA18)" className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <input value={newTaxe.nom} onChange={(e) => setNewTaxe(p => ({ ...p, nom: e.target.value }))} placeholder="Nom" className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <input type="number" value={newTaxe.taux} onChange={(e) => setNewTaxe(p => ({ ...p, taux: e.target.value }))} placeholder="Taux %" className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 [appearance:textfield]" />
            <select value={newTaxe.nature} onChange={(e) => setNewTaxe(p => ({ ...p, nature: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
              {NATURES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>

            <input value={newTaxe.compteCollecteNumero} onChange={(e) => setNewTaxe(p => ({ ...p, compteCollecteNumero: e.target.value }))} placeholder="Compte collecté *" className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <input value={newTaxe.compteDeductibleNumero} onChange={(e) => setNewTaxe(p => ({ ...p, compteDeductibleNumero: e.target.value }))} placeholder="Compte déductible" className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <input value={newTaxe.compteRegularisationNumero} onChange={(e) => setNewTaxe(p => ({ ...p, compteRegularisationNumero: e.target.value }))} placeholder="Compte de régularisation" className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <select value={newTaxe.regimeFiscal} onChange={(e) => setNewTaxe(p => ({ ...p, regimeFiscal: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
              {REGIMES_FISCAUX.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>

            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Date de début</label>
              <input type="date" value={newTaxe.dateDebut} onChange={(e) => setNewTaxe(p => ({ ...p, dateDebut: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Date de fin</label>
              <input type="date" value={newTaxe.dateFin} onChange={(e) => setNewTaxe(p => ({ ...p, dateFin: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 px-1">
              <input type="checkbox" checked={newTaxe.applicableAchat} onChange={(e) => setNewTaxe(p => ({ ...p, applicableAchat: e.target.checked }))} className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
              Applicable à l&apos;achat
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 px-1">
              <input type="checkbox" checked={newTaxe.applicableVente} onChange={(e) => setNewTaxe(p => ({ ...p, applicableVente: e.target.checked }))} className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
              Applicable à la vente
            </label>

            <button onClick={handleCreerTaxe} disabled={creatingTaxe || !newTaxe.code || !newTaxe.nom || !newTaxe.taux || !newTaxe.compteCollecteNumero}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 col-span-2">
              <Save size={14} /> Créer
            </button>
          </div>
        )}
        <div className="space-y-1.5">
          {(taxesData?.data ?? []).map((tx) => (
            <div key={tx.id} className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm ${tx.actif ? "border-slate-200" : "border-slate-100 opacity-50"}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-violet-700">{tx.code}</span>
                <span className="text-slate-700 font-medium">{tx.nom} — {Number(tx.taux)}%</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{tx.nature}</span>
                <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{REGIMES_FISCAUX.find(r => r.value === tx.regimeFiscal)?.label ?? tx.regimeFiscal}</span>
                {tx.applicableAchat && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Achat</span>}
                {tx.applicableVente && <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">Vente</span>}
                {(tx.dateDebut || tx.dateFin) && (
                  <span className="text-xs text-slate-400">
                    {tx.dateDebut ? new Date(tx.dateDebut).toLocaleDateString("fr-FR") : "…"} → {tx.dateFin ? new Date(tx.dateFin).toLocaleDateString("fr-FR") : "…"}
                  </span>
                )}
              </div>
              <button onClick={() => handleToggleTaxe(tx)} className={tx.actif ? "text-amber-500" : "text-emerald-500"}>
                {tx.actif ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
              </button>
            </div>
          ))}
          {(taxesData?.data ?? []).length === 0 && <p className="text-center text-slate-400 text-sm py-4">Aucune taxe paramétrée.</p>}
        </div>
      </div>
    </main>
  );
}
