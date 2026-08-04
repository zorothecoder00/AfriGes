"use client";

// Rubrique "Plan comptable" (clé d'accès "plan").
// Extrait du bloc activeTab === "plan" du monolithe, API /api/comptable/plan-comptable.
//
// Ajout CDC : bouton "Compléter le plan SYSCOHADA" (action "completer_syscohada",
// tout juste ajoutée à la route) à côté du bouton d'import existant — upsert
// additif des comptes manquants (skipDuplicates), utile quand le plan a déjà des
// données puisque "import_syscohada" (all-or-nothing) bloque dans ce cas.

import { useState, useEffect, useMemo } from "react";
import {
  BookMarked, ListChecks, PlusCircle, Search, Save, X, Edit2,
  ChevronLeft, ChevronRight, RefreshCw,
} from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { useT } from "@/contexts/AppSettingsContext";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";

interface CompteComptable {
  id: number; numero: string; libelle: string; classe: number;
  type: string; nature: string; sens: string; actif: boolean; statut: string;
  tiersType: string | null; tiersNom: string | null;
  compteParent?: { numero: string; libelle: string } | null;
}
interface ComptesResponse {
  data: CompteComptable[];
  stats: { classe: number; count: number }[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

const TYPE_COMPTE_LABELS: Record<string, string> = {
  ACTIF: "Actif", PASSIF: "Passif", CHARGES: "Charges",
  PRODUITS: "Produits", TRESORERIE: "Trésorerie",
};

// CDC §5 — une fois qu'un compte a reçu une écriture, sa suppression physique
// est interdite : seuls ces 4 statuts (jamais une suppression) sont possibles,
// son historique restant toujours intact.
const STATUT_COMPTE_LABELS: Record<string, string> = {
  ACTIF: "Actif", DESACTIVE: "Désactivé", ARCHIVE: "Archivé", OBSOLETE: "Obsolète",
};
const STATUT_COMPTE_STYLES: Record<string, string> = {
  ACTIF: "bg-emerald-50 text-emerald-700",
  DESACTIVE: "bg-slate-100 text-slate-500",
  ARCHIVE: "bg-amber-50 text-amber-700",
  OBSOLETE: "bg-red-50 text-red-700",
};

export default function PlanComptablePage() {
  const t = useT();

  const [planPage, setPlanPage]             = useState(1);
  const [planSearch, setPlanSearch]         = useState("");
  const [planSearchDebounced, setPlanSearchDebounced] = useState("");
  const [planClasse, setPlanClasse]         = useState("");
  const [planType, setPlanType]             = useState("");
  const [showAddCompte, setShowAddCompte]   = useState(false);
  const [editCompte, setEditCompte]         = useState<CompteComptable | null>(null);
  const [newCompte, setNewCompte]           = useState({ numero: "", libelle: "", classe: "4", type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" });

  useEffect(() => {
    const tm = setTimeout(() => { setPlanSearchDebounced(planSearch); setPlanPage(1); }, 400);
    return () => clearTimeout(tm);
  }, [planSearch]);

  const planUrl = useMemo(() => {
    const p = new URLSearchParams({ page: String(planPage), limit: "100" });
    if (planSearchDebounced) p.set("search", planSearchDebounced);
    if (planClasse)          p.set("classe", planClasse);
    if (planType)            p.set("type",   planType);
    return `/api/comptable/plan-comptable?${p.toString()}`;
  }, [planPage, planSearchDebounced, planClasse, planType]);

  const { data: planData, loading: planLoading, refetch: refetchPlan } =
    useApi<ComptesResponse>(planUrl);

  const { mutate: importSyscohada, loading: importLoading } = useMutation<unknown, object>(
    "/api/comptable/plan-comptable", "POST",
    { successMessage: "Plan SYSCOHADA importé avec succès !" }
  );
  const { mutate: completerSyscohada, loading: completerLoading } = useMutation<{ success: boolean; count: number }, object>(
    "/api/comptable/plan-comptable", "POST",
    { successMessage: "Plan SYSCOHADA complété" }
  );
  const { mutate: createCompte, loading: creatingCompte } = useMutation<unknown, object>(
    "/api/comptable/plan-comptable", "POST",
    { successMessage: "Compte créé" }
  );
  const { mutate: patchCompte, loading: patchingCompte } = useMutation<unknown, object>(
    "/api/comptable/plan-comptable", "PATCH",
    { successMessage: "Compte mis à jour" }
  );

  async function handleImportSyscohada() {
    await importSyscohada({ action: "import_syscohada" });
    refetchPlan();
  }
  async function handleCompleterSyscohada() {
    await completerSyscohada({ action: "completer_syscohada" });
    refetchPlan();
  }
  async function handleCreateCompte() {
    const res = await createCompte({ ...newCompte, classe: Number(newCompte.classe) });
    if (res) { refetchPlan(); setShowAddCompte(false); setNewCompte({ numero: "", libelle: "", classe: "4", type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" }); }
  }
  async function handleChangeStatutCompte(compte: CompteComptable, statut: string) {
    if (statut === compte.statut) return;
    await patchCompte({ id: compte.id, statut });
    refetchPlan();
  }
  async function handleSaveEditCompte() {
    if (!editCompte) return;
    await patchCompte({ id: editCompte.id, libelle: editCompte.libelle, nature: editCompte.nature });
    refetchPlan();
    setEditCompte(null);
  }

  return (
    <main className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-slate-800">Plan comptable</h1>
        {AIDE_COMPTABLE.plan && <AideComptable contenu={AIDE_COMPTABLE.plan} />}
      </div>

      <div className="space-y-4">
        {/* Header */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <BookMarked className="text-violet-600" size={20} /> Plan Comptable SYSCOHADA
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {planData?.meta.total ?? "…"} comptes · {planData?.stats.length ?? 0} classes
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleImportSyscohada}
                disabled={importLoading}
                title="Importe le plan SYSCOHADA de base — bloqué si le plan comptable contient déjà des comptes"
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                {importLoading
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <ListChecks size={15} />}
                Importer SYSCOHADA
              </button>
              <button
                onClick={handleCompleterSyscohada}
                disabled={completerLoading}
                title="Ajoute uniquement les comptes SYSCOHADA manquants sans toucher aux comptes déjà présents — utilisable même si le plan a déjà des données"
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50"
              >
                {completerLoading
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <RefreshCw size={15} />}
                Compléter le plan SYSCOHADA
              </button>
              <button
                onClick={() => setShowAddCompte(!showAddCompte)}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700"
              >
                <PlusCircle size={15} /> Nouveau compte
              </button>
            </div>
            <p className="text-xs text-slate-400 max-w-md text-right">
              « Importer » exige un plan vide (tout ou rien) · « Compléter » ajoute uniquement les comptes manquants, sans jamais modifier ou dupliquer un compte existant.
            </p>
          </div>
        </div>

        {/* Formulaire ajout */}
        {showAddCompte && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-violet-200">
            <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><PlusCircle size={16} className="text-violet-600" /> Nouveau compte</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Numéro *</label>
                <input value={newCompte.numero} onChange={(e) => setNewCompte(p => ({ ...p, numero: e.target.value }))}
                  placeholder="ex: 411" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-600 mb-1 block">Libellé *</label>
                <input value={newCompte.libelle} onChange={(e) => setNewCompte(p => ({ ...p, libelle: e.target.value }))}
                  placeholder="ex: Clients" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Classe</label>
                <select value={newCompte.classe} onChange={(e) => setNewCompte(p => ({ ...p, classe: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                  {[1,2,3,4,5,6,7,8,9].map(c => <option key={c} value={c}>{c} — {["Ressources durables","Actifs immobilisés","Stocks","Comptes de tiers","Trésorerie","Charges","Produits","Comptes spéciaux","Hors bilan"][c-1]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Type</label>
                <select value={newCompte.type} onChange={(e) => setNewCompte(p => ({ ...p, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                  {Object.entries(TYPE_COMPTE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Sens</label>
                <select value={newCompte.sens} onChange={(e) => setNewCompte(p => ({ ...p, sens: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="DEBITEUR">Débiteur</option>
                  <option value="CREDITEUR">Créditeur</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowAddCompte(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">{t('btn_cancel')}</button>
              <button onClick={handleCreateCompte} disabled={creatingCompte || !newCompte.numero || !newCompte.libelle}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
                {creatingCompte ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />} Créer
              </button>
            </div>
          </div>
        )}

        {/* Filtres */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60 flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={planSearch} onChange={(e) => setPlanSearch(e.target.value)}
              placeholder="Rechercher numéro ou libellé…"
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <select value={planClasse} onChange={(e) => { setPlanClasse(e.target.value); setPlanPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
            <option value="">Toutes les classes</option>
            {[1,2,3,4,5,6,7].map(c => <option key={c} value={c}>Classe {c}</option>)}
          </select>
          <select value={planType} onChange={(e) => { setPlanType(e.target.value); setPlanPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
            <option value="">Tous types</option>
            {Object.entries(TYPE_COMPTE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {/* Tableau plan */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          {planLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="w-8 h-8 border-3 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Numéro</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Libellé</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase hidden md:table-cell">Classe</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase hidden lg:table-cell">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase hidden lg:table-cell">Sens</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Statut</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(planData?.data ?? []).map((c) => (
                  <tr key={c.id} className={`hover:bg-slate-50 transition-colors ${c.statut !== "ACTIF" ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3 font-mono font-bold text-violet-700">{c.numero}</td>
                    <td className="px-4 py-3 text-slate-800">
                      {editCompte?.id === c.id ? (
                        <input value={editCompte.libelle} onChange={(e) => setEditCompte({ ...editCompte, libelle: e.target.value })}
                          className="w-full px-2 py-1 border border-violet-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                      ) : c.libelle}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{c.classe}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        c.type === "ACTIF" ? "bg-blue-50 text-blue-700" :
                        c.type === "PASSIF" ? "bg-purple-50 text-purple-700" :
                        c.type === "CHARGES" ? "bg-red-50 text-red-700" :
                        c.type === "PRODUITS" ? "bg-emerald-50 text-emerald-700" :
                        "bg-amber-50 text-amber-700"
                      }`}>{TYPE_COMPTE_LABELS[c.type] ?? c.type}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">{c.sens === "DEBITEUR" ? "Débiteur" : "Créditeur"}</td>
                    <td className="px-4 py-3 text-center">
                      <select
                        value={c.statut ?? (c.actif ? "ACTIF" : "DESACTIVE")}
                        onChange={(e) => handleChangeStatutCompte(c, e.target.value)}
                        disabled={patchingCompte}
                        title="Un compte utilisé ne peut jamais être supprimé — seul son statut peut changer, son historique reste intact"
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full border-0 focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer ${STATUT_COMPTE_STYLES[c.statut] ?? STATUT_COMPTE_STYLES.DESACTIVE}`}
                      >
                        {Object.entries(STATUT_COMPTE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {editCompte?.id === c.id ? (
                          <>
                            <button onClick={handleSaveEditCompte} disabled={patchingCompte}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Save size={14} /></button>
                            <button onClick={() => setEditCompte(null)}
                              className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={14} /></button>
                          </>
                        ) : (
                          <button onClick={() => setEditCompte(c)}
                            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {(planData?.data ?? []).length === 0 && !planLoading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      <BookMarked size={32} className="mx-auto mb-2 opacity-30" />
                      <p>Aucun compte. Importez le plan SYSCOHADA ou ajoutez des comptes manuellement.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          {planData && planData.meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
              <span className="text-xs text-slate-500">{planData.meta.total} comptes · page {planPage}/{planData.meta.totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPlanPage(p => Math.max(1, p - 1))} disabled={planPage === 1}
                  className="p-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40"><ChevronLeft size={14} /></button>
                <button onClick={() => setPlanPage(p => Math.min(planData.meta.totalPages, p + 1))} disabled={planPage === planData.meta.totalPages}
                  className="p-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40"><ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
