"use client";

// Paramètres — Règles comptables (moteur central).
// Extrait du bloc activeTab === "regles" du monolithe (app/dashboard/user/comptables/page.tsx,
// ~ligne 3959), consommant /api/comptable/regles (~ligne 1106).
import { useRef, useState } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { ListChecks, PlusCircle, Save, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";

interface RegleComptableEntry {
  id: number;
  evenement: string;
  moduleSource: string;
  conditionProduit: string | null;
  conditionFamille: string | null;
  conditionCategorie: string | null;
  conditionModePaiement: string | null;
  compteDebitNumero: string;
  compteCreditNumero: string;
  journal: string;
  compteTvaNumero: string | null;
  sectionAnalytiqueId: number | null;
  centreCoutId: number | null;
  devise: string | null;
  dateDebutValidite: string | null;
  dateFinValidite: string | null;
  priorite: number;
  actif: boolean;
  mode: string;
  notes: string | null;
}
interface JournalComptableEntry {
  id: number | null; code: string; libelle: string; prefixe: string | null; actif: boolean; builtin: boolean;
}
interface SectionAnalytiqueEntry { id: number; axe: string; code: string; libelle: string }
const JOURNAL_LABELS: Record<string, string> = {
  CAISSE: "Caisse", BANQUE: "Banque", VENTES: "Ventes",
  ACHATS: "Achats", OD: "Opérations diverses", PAIE: "Paie",
  IMMOBILISATIONS: "Immobilisations", CLOTURE: "Clôture",
  OUVERTURE: "Ouverture", REGULARISATION: "Régularisation",
};

const REGLE_VIDE = {
  evenement: "", moduleSource: "", compteDebitNumero: "", compteCreditNumero: "",
  journal: "OD", conditionProduit: "", conditionFamille: "", conditionCategorie: "", conditionModePaiement: "",
  compteTvaNumero: "", sectionAnalytiqueId: "", centreCoutId: "", devise: "", dateDebutValidite: "", dateFinValidite: "",
  priorite: "0",
};

export default function ReglesComptablesPage() {
  const { data: journauxData } = useApi<{ data: JournalComptableEntry[] }>("/api/comptable/journaux");
  const { data: sectionsData } = useApi<{ data: SectionAnalytiqueEntry[] }>("/api/comptable/analytique/sections");
  const sectionsAnalytiques = (sectionsData?.data ?? []).filter((s) => s.axe !== "CENTRE_COUT");
  const centresCout = (sectionsData?.data ?? []).filter((s) => s.axe === "CENTRE_COUT");

  const { data: reglesData, loading: reglesLoading, refetch: refetchRegles } =
    useApi<{ data: RegleComptableEntry[] }>("/api/comptable/regles");

  const { mutate: creerRegle, loading: creatingRegle } = useMutation<unknown, object>(
    "/api/comptable/regles", "POST",
    { successMessage: "Règle comptable créée" }
  );
  const regleActionIdRef = useRef<number | null>(null);
  const { mutate: majRegle } = useMutation<unknown, object>(
    () => `/api/comptable/regles/${regleActionIdRef.current}`, "PUT",
  );
  const { mutate: supprimerRegle } = useMutation<unknown, object>(
    () => `/api/comptable/regles/${regleActionIdRef.current}`, "DELETE",
    { successMessage: "Règle supprimée" }
  );

  const [showAddRegle, setShowAddRegle] = useState(false);
  const [newRegle, setNewRegle]         = useState(REGLE_VIDE);
  const [editRegleId, setEditRegleId]   = useState<number | null>(null);

  async function handleCreerRegle() {
    const res = await creerRegle({
      ...newRegle,
      priorite: Number(newRegle.priorite) || 0,
      conditionProduit: newRegle.conditionProduit || null,
      conditionFamille: newRegle.conditionFamille || null,
      conditionCategorie: newRegle.conditionCategorie || null,
      conditionModePaiement: newRegle.conditionModePaiement || null,
      compteTvaNumero: newRegle.compteTvaNumero || null,
      sectionAnalytiqueId: newRegle.sectionAnalytiqueId || null,
      centreCoutId: newRegle.centreCoutId || null,
      devise: newRegle.devise || null,
      dateDebutValidite: newRegle.dateDebutValidite || null,
      dateFinValidite: newRegle.dateFinValidite || null,
    });
    if (res) { refetchRegles(); setShowAddRegle(false); setNewRegle(REGLE_VIDE); }
  }
  async function handleToggleRegle(r: RegleComptableEntry) {
    regleActionIdRef.current = r.id;
    const res = await majRegle({ actif: !r.actif });
    if (res) refetchRegles();
  }
  async function handleSupprimerRegle(id: number) {
    regleActionIdRef.current = id;
    const res = await supprimerRegle({});
    if (res) refetchRegles();
  }

  return (
    <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ListChecks className="text-emerald-600" size={22} /> Règles comptables
        </h2>
        {AIDE_COMPTABLE.regles && <AideComptable contenu={AIDE_COMPTABLE.regles} />}
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
          Associez un événement métier (vente à crédit, remboursement, paie…) aux comptes débit/crédit à utiliser.
          Une règle active personnalisée prend le pas sur la règle par défaut ; aucune saisie de compte en dur dans le code.
        </p>
        <button
          onClick={() => { setShowAddRegle(!showAddRegle); setEditRegleId(null); setNewRegle(REGLE_VIDE); }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700"
        >
          <PlusCircle size={15} /> Nouvelle règle
        </button>
      </div>

      {showAddRegle && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-emerald-200">
          <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><PlusCircle size={16} className="text-emerald-600" /> Nouvelle règle</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Événement *</label>
              <input value={newRegle.evenement} onChange={(e) => setNewRegle(p => ({ ...p, evenement: e.target.value }))}
                placeholder="ex: VENTE_CREDIT_VALIDEE" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Module source *</label>
              <input value={newRegle.moduleSource} onChange={(e) => setNewRegle(p => ({ ...p, moduleSource: e.target.value }))}
                placeholder="ex: CREDIT" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Journal *</label>
              <select value={newRegle.journal} onChange={(e) => setNewRegle(p => ({ ...p, journal: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {(journauxData?.data ?? []).filter(j => j.actif).map(j => <option key={j.code} value={j.code}>{j.libelle}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Compte débit *</label>
              <input value={newRegle.compteDebitNumero} onChange={(e) => setNewRegle(p => ({ ...p, compteDebitNumero: e.target.value }))}
                placeholder="ex: 411" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Compte crédit *</label>
              <input value={newRegle.compteCreditNumero} onChange={(e) => setNewRegle(p => ({ ...p, compteCreditNumero: e.target.value }))}
                placeholder="ex: 701" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Condition produit</label>
              <input value={newRegle.conditionProduit} onChange={(e) => setNewRegle(p => ({ ...p, conditionProduit: e.target.value }))}
                placeholder="ex: Riz local (optionnel)" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Condition famille</label>
              <input value={newRegle.conditionFamille} onChange={(e) => setNewRegle(p => ({ ...p, conditionFamille: e.target.value }))}
                placeholder="ex: Denrées alimentaires (optionnel)" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Condition catégorie</label>
              <input value={newRegle.conditionCategorie} onChange={(e) => setNewRegle(p => ({ ...p, conditionCategorie: e.target.value }))}
                placeholder="ex: Riz (optionnel)" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Condition mode de paiement</label>
              <input value={newRegle.conditionModePaiement} onChange={(e) => setNewRegle(p => ({ ...p, conditionModePaiement: e.target.value }))}
                placeholder="ex: VIREMENT (optionnel)" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Priorité</label>
              <input type="number" value={newRegle.priorite} onChange={(e) => setNewRegle(p => ({ ...p, priorite: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Taxe (compte TVA)</label>
              <input value={newRegle.compteTvaNumero} onChange={(e) => setNewRegle(p => ({ ...p, compteTvaNumero: e.target.value }))}
                placeholder="ex: 4431 (optionnel)" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Analytique</label>
              <select value={newRegle.sectionAnalytiqueId} onChange={(e) => setNewRegle(p => ({ ...p, sectionAnalytiqueId: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">— Aucune —</option>
                {sectionsAnalytiques.map(s => <option key={s.id} value={s.id}>{s.libelle} ({s.axe})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Centre de coût</label>
              <select value={newRegle.centreCoutId} onChange={(e) => setNewRegle(p => ({ ...p, centreCoutId: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">— Aucun —</option>
                {centresCout.map(s => <option key={s.id} value={s.id}>{s.libelle}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Devise</label>
              <input value={newRegle.devise} onChange={(e) => setNewRegle(p => ({ ...p, devise: e.target.value }))}
                placeholder="ex: USD (optionnel, défaut XOF)" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Valide à partir du</label>
              <input type="date" value={newRegle.dateDebutValidite} onChange={(e) => setNewRegle(p => ({ ...p, dateDebutValidite: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Valide jusqu&apos;au</label>
              <input type="date" value={newRegle.dateFinValidite} onChange={(e) => setNewRegle(p => ({ ...p, dateFinValidite: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setShowAddRegle(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Annuler</button>
            <button onClick={handleCreerRegle}
              disabled={creatingRegle || !newRegle.evenement || !newRegle.moduleSource || !newRegle.compteDebitNumero || !newRegle.compteCreditNumero}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
              {creatingRegle ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />} Créer
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        {reglesLoading ? (
          <div className="flex items-center justify-center p-12">
            <div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Événement</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase hidden md:table-cell">Module</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Débit</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Crédit</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase hidden lg:table-cell">Journal</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs uppercase hidden lg:table-cell">Priorité</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Statut</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(reglesData?.data ?? []).map((r) => (
                <tr key={r.id} className={`hover:bg-slate-50 transition-colors ${!r.actif ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 font-mono text-xs font-bold text-emerald-700">
                    {r.evenement}
                    {r.conditionProduit && <span className="ml-2 text-xs font-sans text-slate-400">produit={r.conditionProduit}</span>}
                    {r.conditionFamille && <span className="ml-2 text-xs font-sans text-slate-400">famille={r.conditionFamille}</span>}
                    {r.conditionCategorie && <span className="ml-2 text-xs font-sans text-slate-400">catégorie={r.conditionCategorie}</span>}
                    {r.conditionModePaiement && <span className="ml-2 text-xs font-sans text-slate-400">si {r.conditionModePaiement}</span>}
                    {r.compteTvaNumero && <span className="ml-2 text-xs font-sans text-slate-400">TVA={r.compteTvaNumero}</span>}
                    {r.devise && <span className="ml-2 text-xs font-sans text-slate-400">devise={r.devise}</span>}
                    {(r.dateDebutValidite || r.dateFinValidite) && (
                      <span className="ml-2 text-xs font-sans text-slate-400">
                        valide {r.dateDebutValidite ? `du ${r.dateDebutValidite.slice(0, 10)}` : ""} {r.dateFinValidite ? `au ${r.dateFinValidite.slice(0, 10)}` : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{r.moduleSource}</td>
                  <td className="px-4 py-3 font-mono text-blue-700">{r.compteDebitNumero}</td>
                  <td className="px-4 py-3 font-mono text-emerald-700">{r.compteCreditNumero}</td>
                  <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">{JOURNAL_LABELS[r.journal] ?? r.journal}</td>
                  <td className="px-4 py-3 text-center text-slate-500 hidden lg:table-cell">{r.priorite}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.actif ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {r.actif ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleToggleRegle(r)}
                        className={`p-1.5 rounded-lg ${r.actif ? "text-amber-500 hover:bg-amber-50" : "text-emerald-500 hover:bg-emerald-50"}`}
                        title={r.actif ? "Désactiver" : "Activer"}>
                        {r.actif ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      </button>
                      <button onClick={() => handleSupprimerRegle(r.id)}
                        className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {(reglesData?.data ?? []).length === 0 && !reglesLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <ListChecks size={32} className="mx-auto mb-2 opacity-30" />
                    <p>Aucune règle personnalisée. Les événements utilisent les comptes par défaut (411/701, 571/521, 661).</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
