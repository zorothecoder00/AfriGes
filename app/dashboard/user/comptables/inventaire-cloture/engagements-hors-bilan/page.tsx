"use client";

// Inventaire & clôture — Engagements hors-bilan (CDC §39).
// Cautions, garanties, crédit-bail, litiges en cours : n'affectent pas le bilan
// directement mais doivent être suivis et divulgués en notes annexes tant qu'ils
// sont actifs. Un engagement "levé" (caution restituée, litige clos, etc.) reste
// visible à titre d'historique mais sort du total présenté en notes annexes.
import { useMemo, useRef, useState } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { ShieldCheck, PlusCircle, Save, CheckCircle2 } from "lucide-react";

type Type = "CAUTION_DONNEE" | "CAUTION_RECUE" | "GARANTIE_DONNEE" | "GARANTIE_RECUE" | "CREDIT_BAIL" | "LITIGE_EN_COURS" | "AUTRE";
type Statut = "ACTIF" | "LEVE";

interface EngagementEntry {
  id: number; reference: string; libelle: string; type: Type; montant: number | string;
  beneficiaire: string | null; dateDebut: string; dateFin: string | null;
  statut: Statut; dateLevee: string | null; notes: string | null;
  creePar: { nom: string; prenom: string };
}

const TYPE_LABELS: Record<Type, string> = {
  CAUTION_DONNEE: "Caution donnée", CAUTION_RECUE: "Caution reçue",
  GARANTIE_DONNEE: "Garantie donnée", GARANTIE_RECUE: "Garantie reçue",
  CREDIT_BAIL: "Crédit-bail", LITIGE_EN_COURS: "Litige en cours", AUTRE: "Autre",
};
const STATUT_COLORS: Record<Statut, string> = { ACTIF: "bg-amber-50 text-amber-700", LEVE: "bg-slate-100 text-slate-500" };

const ENGAGEMENT_VIDE = {
  libelle: "", type: "CAUTION_DONNEE" as Type, montant: "", beneficiaire: "",
  dateDebut: new Date().toISOString().slice(0, 10), dateFin: "", notes: "",
};

export default function EngagementsHorsBilanPage() {
  const [filterType, setFilterType] = useState("");
  const [filterStatut, setFilterStatut] = useState("");

  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (filterType) p.set("type", filterType);
    if (filterStatut) p.set("statut", filterStatut);
    const qs = p.toString();
    return `/api/comptable/engagements-hors-bilan${qs ? `?${qs}` : ""}`;
  }, [filterType, filterStatut]);

  const { data, loading, refetch } = useApi<{ data: EngagementEntry[] }>(url);

  const [showAdd, setShowAdd] = useState(false);
  const [newEngagement, setNewEngagement] = useState(ENGAGEMENT_VIDE);
  const { mutate: creerEngagement, loading: creating } = useMutation<unknown, object>(
    "/api/comptable/engagements-hors-bilan", "POST", { successMessage: "Engagement enregistré" }
  );
  async function handleCreer() {
    const res = await creerEngagement({
      ...newEngagement, montant: Number(newEngagement.montant),
      beneficiaire: newEngagement.beneficiaire || undefined, dateFin: newEngagement.dateFin || undefined,
      notes: newEngagement.notes || undefined,
    });
    if (res) { setShowAdd(false); setNewEngagement(ENGAGEMENT_VIDE); refetch(); }
  }

  const actionIdRef = useRef<number | null>(null);
  const { mutate: leverApi, loading: levant } = useMutation<unknown, object>(
    () => `/api/comptable/engagements-hors-bilan/${actionIdRef.current}`, "PATCH",
    { successMessage: "Engagement levé" }
  );
  async function handleLever(id: number) {
    actionIdRef.current = id;
    const res = await leverApi({ statut: "LEVE" });
    if (res) refetch();
  }

  const engagements = data?.data ?? [];

  return (
    <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="text-emerald-600" size={22} /> Engagements hors-bilan
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Cautions, garanties, crédit-bail, litiges — suivis et divulgués en notes annexes tant qu&apos;actifs.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">Tous types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">Tous statuts</option>
            <option value="ACTIF">Actif</option>
            <option value="LEVE">Levé</option>
          </select>
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">
            <PlusCircle size={15} /> Nouvel engagement
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-emerald-200">
          <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><PlusCircle size={16} className="text-emerald-600" /> Nouvel engagement</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Libellé *</label>
              <input value={newEngagement.libelle} onChange={(e) => setNewEngagement(p => ({ ...p, libelle: e.target.value }))}
                placeholder="ex: Caution bail agence Lomé" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Type *</label>
              <select value={newEngagement.type} onChange={(e) => setNewEngagement(p => ({ ...p, type: e.target.value as Type }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Bénéficiaire / contrepartie</label>
              <input value={newEngagement.beneficiaire} onChange={(e) => setNewEngagement(p => ({ ...p, beneficiaire: e.target.value }))}
                placeholder="ex: Bailleur, banque, client..." className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Montant *</label>
              <input type="number" value={newEngagement.montant} onChange={(e) => setNewEngagement(p => ({ ...p, montant: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 [appearance:textfield]" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Date de début *</label>
              <input type="date" value={newEngagement.dateDebut} onChange={(e) => setNewEngagement(p => ({ ...p, dateDebut: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Date de fin (échéance)</label>
              <input type="date" value={newEngagement.dateFin} onChange={(e) => setNewEngagement(p => ({ ...p, dateFin: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div className="col-span-2 md:col-span-3">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Notes</label>
              <input value={newEngagement.notes} onChange={(e) => setNewEngagement(p => ({ ...p, notes: e.target.value }))}
                placeholder="détails complémentaires" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Annuler</button>
            <button onClick={handleCreer}
              disabled={creating || !newEngagement.libelle || !newEngagement.montant || !newEngagement.dateDebut}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
              {creating ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />} Enregistrer
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12"><div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /></div>
        ) : engagements.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <ShieldCheck size={32} className="mx-auto mb-2 opacity-30" />
            <p>Aucun engagement hors-bilan enregistré.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Référence</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Libellé</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase hidden md:table-cell">Type</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Montant</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase hidden lg:table-cell">Période</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Statut</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {engagements.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{e.reference}</td>
                  <td className="px-4 py-3 text-slate-800">
                    {e.libelle}
                    {e.beneficiaire && <span className="block text-xs text-slate-400">{e.beneficiaire}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{TYPE_LABELS[e.type]}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(Number(e.montant))}</td>
                  <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                    {formatDateShort(e.dateDebut)}{e.dateFin ? ` → ${formatDateShort(e.dateFin)}` : ""}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUT_COLORS[e.statut]}`}>
                      {e.statut === "ACTIF" ? "Actif" : "Levé"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {e.statut === "ACTIF" && (
                      <button onClick={() => handleLever(e.id)} disabled={levant}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-700 disabled:opacity-50 ml-auto">
                        <CheckCircle2 size={12} /> Lever
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
