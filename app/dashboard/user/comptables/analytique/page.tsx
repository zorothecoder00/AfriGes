"use client";

import { useState, useRef } from "react";
import { TrendingUp, PlusCircle, ToggleLeft, ToggleRight, Calculator, Save } from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";

// ── Types ──────────────────────────────────────────────────────────────────

interface SectionAnalytiqueEntry { id: number; axe: string; code: string; libelle: string; actif: boolean }
interface BudgetEntry { id: number; annee: number; libelle: string | null; statut: string }
interface LigneBudgetEntry {
  id: number; mois: number; montantPrevu: number; realise: number; ecart: number;
  compte: { numero: string; libelle: string };
  sectionAnalytique?: { libelle: string; axe: string } | null;
  pointDeVente?: { nom: string } | null;
}

const AXE_LABELS: Record<string, string> = { ACTIVITE: "Activité", PROJET: "Projet", DEPARTEMENT: "Département" };
const MOIS_LABELS = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"];

export default function AnalytiquePage() {
  // ── État Analytique & Budget ───────────────────────────────────────────
  const [newSection, setNewSection] = useState({ axe: "DEPARTEMENT", code: "", libelle: "" });
  const [budgetAnnee, setBudgetAnnee] = useState(() => String(new Date().getFullYear()));
  const NOUVELLE_LIGNE_BUDGET = { compteNumero: "", mois: String(new Date().getMonth() + 1), montantPrevu: "", sectionAnalytiqueId: "" };
  const [nouvelleLigneBudget, setNouvelleLigneBudget] = useState(NOUVELLE_LIGNE_BUDGET);

  // ── Analytique & Budget API ────────────────────────────────────────────
  const { data: sectionsData, refetch: refetchSections } =
    useApi<{ data: SectionAnalytiqueEntry[] }>("/api/comptable/analytique/sections");

  const { mutate: creerSection, loading: creatingSection } = useMutation<unknown, object>(
    "/api/comptable/analytique/sections", "POST",
    { successMessage: "Section analytique créée" }
  );
  const sectionActionIdRef = useRef<number | null>(null);
  const { mutate: toggleSectionApi } = useMutation<unknown, object>(
    () => `/api/comptable/analytique/sections/${sectionActionIdRef.current}`, "PATCH",
  );

  async function handleCreerSection() {
    const res = await creerSection(newSection);
    if (res) { refetchSections(); setNewSection({ axe: "DEPARTEMENT", code: "", libelle: "" }); }
  }
  async function handleToggleSection(s: SectionAnalytiqueEntry) {
    sectionActionIdRef.current = s.id;
    const res = await toggleSectionApi({ actif: !s.actif });
    if (res) refetchSections();
  }

  const { data: budgetData, refetch: refetchBudget } =
    useApi<{ data: BudgetEntry | null }>(`/api/comptable/budget?annee=${budgetAnnee}`);

  const { mutate: creerBudget, loading: creatingBudget } = useMutation<{ data: BudgetEntry }, object>(
    "/api/comptable/budget", "POST",
  );
  async function handleCreerBudget() {
    const res = await creerBudget({ annee: Number(budgetAnnee) });
    if (res) refetchBudget();
  }

  const { data: lignesBudgetData, refetch: refetchLignesBudget } =
    useApi<{ data: LigneBudgetEntry[] }>(budgetData?.data ? `/api/comptable/budget/${budgetData.data.id}/lignes` : null);

  const { mutate: ajouterLigneBudget, loading: ajoutantLigneBudget } = useMutation<unknown, object>(
    () => `/api/comptable/budget/${budgetData?.data?.id}/lignes`, "POST",
    { successMessage: "Ligne budgétaire enregistrée" }
  );
  async function handleAjouterLigneBudget() {
    const res = await ajouterLigneBudget({
      compteNumero: nouvelleLigneBudget.compteNumero,
      mois: Number(nouvelleLigneBudget.mois),
      montantPrevu: Number(nouvelleLigneBudget.montantPrevu),
      sectionAnalytiqueId: nouvelleLigneBudget.sectionAnalytiqueId ? Number(nouvelleLigneBudget.sectionAnalytiqueId) : undefined,
    });
    if (res) { refetchLignesBudget(); setNouvelleLigneBudget({ ...NOUVELLE_LIGNE_BUDGET, mois: nouvelleLigneBudget.mois }); }
  }

  return (
    <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="text-violet-600" size={22} /> Analytique
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {AIDE_COMPTABLE["analytique"] && <AideComptable contenu={AIDE_COMPTABLE["analytique"]} />}
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-1">
            <TrendingUp className="text-violet-600" size={20} /> Sections analytiques
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Axes Activité, Projet et Département (CDC §24) — les axes Point de vente et Produit réutilisent directement vos PDV et votre catalogue.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <select value={newSection.axe} onChange={(e) => setNewSection(p => ({ ...p, axe: e.target.value }))}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
              {Object.entries(AXE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input value={newSection.code} onChange={(e) => setNewSection(p => ({ ...p, code: e.target.value }))}
              placeholder="Code (ex: MKT)" className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <input value={newSection.libelle} onChange={(e) => setNewSection(p => ({ ...p, libelle: e.target.value }))}
              placeholder="Libellé (ex: Marketing)" className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <button onClick={handleCreerSection} disabled={creatingSection || !newSection.code || !newSection.libelle}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
              <PlusCircle size={15} /> Ajouter
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(AXE_LABELS).map(([axe, label]) => (
              <div key={axe}>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">{label}</p>
                <div className="space-y-1">
                  {(sectionsData?.data ?? []).filter(s => s.axe === axe).map(s => (
                    <div key={s.id} className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-sm ${s.actif ? "border-slate-200" : "border-slate-100 opacity-50"}`}>
                      <span className="text-slate-700">{s.libelle} <span className="text-xs text-slate-400 font-mono">{s.code}</span></span>
                      <button onClick={() => handleToggleSection(s)} className={s.actif ? "text-amber-500" : "text-emerald-500"}>
                        {s.actif ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      </button>
                    </div>
                  ))}
                  {(sectionsData?.data ?? []).filter(s => s.axe === axe).length === 0 && (
                    <p className="text-xs text-slate-300 italic">Aucune section</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Calculator className="text-violet-600" size={20} /> Budget {budgetAnnee}
            </h3>
            <div className="flex items-center gap-2">
              <input type="number" value={budgetAnnee} onChange={(e) => setBudgetAnnee(e.target.value)}
                className="w-24 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 [appearance:textfield]" />
              {!budgetData?.data && (
                <button onClick={handleCreerBudget} disabled={creatingBudget}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
                  <PlusCircle size={15} /> Créer le budget {budgetAnnee}
                </button>
              )}
            </div>
          </div>

          {budgetData?.data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <input value={nouvelleLigneBudget.compteNumero} onChange={(e) => setNouvelleLigneBudget(p => ({ ...p, compteNumero: e.target.value }))}
                  placeholder="N° compte (ex: 623)" className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                <select value={nouvelleLigneBudget.mois} onChange={(e) => setNouvelleLigneBudget(p => ({ ...p, mois: e.target.value }))}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                  {MOIS_LABELS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <select value={nouvelleLigneBudget.sectionAnalytiqueId} onChange={(e) => setNouvelleLigneBudget(p => ({ ...p, sectionAnalytiqueId: e.target.value }))}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="">Sans section</option>
                  {(sectionsData?.data ?? []).filter(s => s.actif).map(s => <option key={s.id} value={s.id}>{AXE_LABELS[s.axe]} — {s.libelle}</option>)}
                </select>
                <input type="number" value={nouvelleLigneBudget.montantPrevu} onChange={(e) => setNouvelleLigneBudget(p => ({ ...p, montantPrevu: e.target.value }))}
                  placeholder="Montant prévu" className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 [appearance:textfield]" />
                <button onClick={handleAjouterLigneBudget} disabled={ajoutantLigneBudget || !nouvelleLigneBudget.compteNumero || !nouvelleLigneBudget.montantPrevu}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
                  <Save size={14} /> Enregistrer
                </button>
              </div>

              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs uppercase">Compte</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs uppercase">Mois</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs uppercase hidden md:table-cell">Section</th>
                    <th className="text-right px-3 py-2 font-semibold text-slate-600 text-xs uppercase">Budget</th>
                    <th className="text-right px-3 py-2 font-semibold text-slate-600 text-xs uppercase">Réalisé</th>
                    <th className="text-right px-3 py-2 font-semibold text-slate-600 text-xs uppercase">Écart</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(lignesBudgetData?.data ?? []).map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-xs text-violet-700">{l.compte.numero} <span className="text-slate-400 font-sans">{l.compte.libelle}</span></td>
                      <td className="px-3 py-2 text-slate-600">{MOIS_LABELS[l.mois - 1]}</td>
                      <td className="px-3 py-2 text-slate-500 hidden md:table-cell">{l.sectionAnalytique?.libelle ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-medium text-slate-700">{formatCurrency(l.montantPrevu)}</td>
                      <td className="px-3 py-2 text-right text-blue-700">{formatCurrency(l.realise)}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${l.ecart >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(l.ecart)}</td>
                    </tr>
                  ))}
                  {(lignesBudgetData?.data ?? []).length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">Aucune ligne budgétaire pour {budgetAnnee}.</td></tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
