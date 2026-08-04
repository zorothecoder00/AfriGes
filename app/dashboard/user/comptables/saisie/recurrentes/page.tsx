"use client";

// Rubrique "Saisie comptable" → sous-page "Récurrentes" (clé d'accès "recurrentes").
// Extrait de la partie "Écritures récurrentes" du bloc activeTab === "exercices"
// du monolithe (le reste de ce bloc — journaux additionnels, exercices, taxes —
// est traité par d'autres rubriques du nouveau menu).
//
// Note : lib/aideComptableContenu.ts n'a pas d'entrée AIDE_COMPTABLE dédiée à
// "recurrentes" (seulement une entrée "exercices" qui couvre aussi taxes/clôture),
// donc pas de bouton Aide contextuelle ici pour ne pas afficher un contenu hors sujet.

import { useState, useRef } from "react";
import { PlusCircle, RefreshCw, Save, ToggleLeft, ToggleRight } from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";

interface JournalComptableEntry {
  id: number | null; code: string; libelle: string; prefixe: string | null; actif: boolean; builtin: boolean;
}
interface EcritureRecurrenteEntry {
  id: number; libelle: string; montant: number; compteDebitNumero: string; compteCreditNumero: string;
  journal: string; frequence: string; dateDebut: string; dateFin: string | null;
  nombreOccurrencesMax: number | null; nombreOccurrencesGenerees: number; statut: string;
}

const FREQUENCE_LABELS: Record<string, string> = { MENSUEL: "Mensuel", TRIMESTRIEL: "Trimestriel", ANNUEL: "Annuel" };
const RECURRENTE_VIDE = { libelle: "", montant: "", compteDebitNumero: "", compteCreditNumero: "", journal: "OD", frequence: "MENSUEL", dateDebut: "" };

export default function RecurrentesPage() {
  const { data: journauxData } = useApi<{ data: JournalComptableEntry[] }>("/api/comptable/journaux");

  const { data: recurrentesData, refetch: refetchRecurrentes } =
    useApi<{ data: EcritureRecurrenteEntry[] }>("/api/comptable/recurrentes");
  const { mutate: creerRecurrente, loading: creatingRecurrente } = useMutation<unknown, object>(
    "/api/comptable/recurrentes", "POST", { successMessage: "Écriture récurrente créée" }
  );
  const recurrenteActionIdRef = useRef<number | null>(null);
  const { mutate: toggleRecurrenteApi } = useMutation<unknown, object>(
    () => `/api/comptable/recurrentes/${recurrenteActionIdRef.current}`, "PATCH",
  );
  const { mutate: genererRecurrentes, loading: generantRecurrentes } = useMutation<{ message: string }, object>(
    "/api/comptable/recurrentes/generer", "POST",
  );

  const [showAddRecurrente, setShowAddRecurrente] = useState(false);
  const [newRecurrente, setNewRecurrente] = useState(RECURRENTE_VIDE);

  async function handleCreerRecurrente() {
    const res = await creerRecurrente({ ...newRecurrente, montant: Number(newRecurrente.montant) });
    if (res) { refetchRecurrentes(); setShowAddRecurrente(false); setNewRecurrente(RECURRENTE_VIDE); }
  }
  async function handleToggleRecurrente(r: EcritureRecurrenteEntry) {
    recurrenteActionIdRef.current = r.id;
    const res = await toggleRecurrenteApi({ statut: r.statut === "ACTIF" ? "SUSPENDU" : "ACTIF" });
    if (res) refetchRecurrentes();
  }
  async function handleGenererRecurrentes() {
    const res = await genererRecurrentes({});
    if (res) refetchRecurrentes();
  }

  return (
    <main className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <h1 className="text-2xl font-bold text-slate-800">Saisie comptable — Écritures récurrentes</h1>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><RefreshCw className="text-violet-600" size={20} /> Écritures récurrentes</h3>
          <div className="flex items-center gap-2">
            <button onClick={handleGenererRecurrentes} disabled={generantRecurrentes}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
              {generantRecurrentes ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <RefreshCw size={15} />} Générer les échéances dues
            </button>
            <button onClick={() => setShowAddRecurrente(!showAddRecurrente)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700">
              <PlusCircle size={15} /> Nouvelle
            </button>
          </div>
        </div>
        {showAddRecurrente && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <input value={newRecurrente.libelle} onChange={(e) => setNewRecurrente(p => ({ ...p, libelle: e.target.value }))} placeholder="Libellé (ex: Loyer agence)" className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 col-span-2" />
            <input type="number" value={newRecurrente.montant} onChange={(e) => setNewRecurrente(p => ({ ...p, montant: e.target.value }))} placeholder="Montant" className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 [appearance:textfield]" />
            <select value={newRecurrente.frequence} onChange={(e) => setNewRecurrente(p => ({ ...p, frequence: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
              {Object.entries(FREQUENCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input value={newRecurrente.compteDebitNumero} onChange={(e) => setNewRecurrente(p => ({ ...p, compteDebitNumero: e.target.value }))} placeholder="Compte débit" className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <input value={newRecurrente.compteCreditNumero} onChange={(e) => setNewRecurrente(p => ({ ...p, compteCreditNumero: e.target.value }))} placeholder="Compte crédit" className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <select value={newRecurrente.journal} onChange={(e) => setNewRecurrente(p => ({ ...p, journal: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
              {(journauxData?.data ?? []).filter(j => j.actif).map(j => <option key={j.code} value={j.code}>{j.libelle}</option>)}
            </select>
            <input type="date" value={newRecurrente.dateDebut} onChange={(e) => setNewRecurrente(p => ({ ...p, dateDebut: e.target.value }))} className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <button onClick={handleCreerRecurrente}
              disabled={creatingRecurrente || !newRecurrente.libelle || !newRecurrente.montant || !newRecurrente.compteDebitNumero || !newRecurrente.compteCreditNumero || !newRecurrente.dateDebut}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
              <Save size={14} /> Créer
            </button>
          </div>
        )}
        <div className="space-y-1">
          {(recurrentesData?.data ?? []).map((r) => (
            <div key={r.id} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${r.statut === "ACTIF" ? "border-slate-200" : "border-slate-100 opacity-50"}`}>
              <span className="text-slate-700">{r.libelle} — {formatCurrency(Number(r.montant))} <span className="text-xs text-slate-400">({FREQUENCE_LABELS[r.frequence]}, {r.nombreOccurrencesGenerees}{r.nombreOccurrencesMax ? `/${r.nombreOccurrencesMax}` : ""})</span></span>
              {r.statut !== "TERMINE" && (
                <button onClick={() => handleToggleRecurrente(r)} className={r.statut === "ACTIF" ? "text-amber-500" : "text-emerald-500"}>
                  {r.statut === "ACTIF" ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                </button>
              )}
            </div>
          ))}
          {(recurrentesData?.data ?? []).length === 0 && <p className="text-center text-slate-400 text-sm py-4">Aucune écriture récurrente.</p>}
        </div>
      </div>
    </main>
  );
}
