"use client";

import { useState, useRef } from "react";
import { Percent, PlusCircle, Save, ToggleLeft, ToggleRight } from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";

// ── Types ──────────────────────────────────────────────────────────────────

interface TaxeConfigEntry {
  id: number; code: string; nom: string; taux: number; nature: string;
  compteCollecteNumero: string; compteDeductibleNumero: string | null;
  applicableAchat: boolean; applicableVente: boolean; actif: boolean;
}

const TAXE_VIDE = { code: "", nom: "", taux: "", nature: "TVA", compteCollecteNumero: "", compteDeductibleNumero: "" };

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
    const res = await creerTaxe({ ...newTaxe, taux: Number(newTaxe.taux) });
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
            <input value={newTaxe.compteCollecteNumero} onChange={(e) => setNewTaxe(p => ({ ...p, compteCollecteNumero: e.target.value }))} placeholder="Compte collecté" className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <input value={newTaxe.compteDeductibleNumero} onChange={(e) => setNewTaxe(p => ({ ...p, compteDeductibleNumero: e.target.value }))} placeholder="Compte déductible" className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <button onClick={handleCreerTaxe} disabled={creatingTaxe || !newTaxe.code || !newTaxe.nom || !newTaxe.taux || !newTaxe.compteCollecteNumero}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 col-span-2 md:col-span-1">
              <Save size={14} /> Créer
            </button>
          </div>
        )}
        <div className="space-y-1">
          {(taxesData?.data ?? []).map((tx) => (
            <div key={tx.id} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${tx.actif ? "border-slate-200" : "border-slate-100 opacity-50"}`}>
              <span className="text-slate-700"><span className="font-mono text-xs text-violet-700">{tx.code}</span> {tx.nom} — {Number(tx.taux)}%</span>
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
