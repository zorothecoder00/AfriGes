"use client";

// Inventaire & clôture — Provisions & dépréciations (page NEUVE).
// CRUD sur ProvisionDepreciation (lib/comptabilite/provisions.ts) : constitution
// du registre, puis dotation/reprise via le moteur central. Statuts ACTIVE →
// PARTIELLEMENT_REPRISE → SOLDEE (montantActuel atteint 0).
import { useMemo, useRef, useState } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { ShieldAlert, PlusCircle, Save, TrendingUp, TrendingDown, X } from "lucide-react";

type TypeProvision = "PROVISION_RISQUE_CHARGE" | "DEPRECIATION_STOCK" | "DEPRECIATION_CLIENT" | "DEPRECIATION_IMMOBILISATION";
type StatutProvision = "ACTIVE" | "PARTIELLEMENT_REPRISE" | "SOLDEE";

interface ProvisionEntry {
  id: number;
  libelle: string;
  type: TypeProvision;
  montantInitial: number | string;
  montantActuel: number | string;
  statut: StatutProvision;
  dateConstitution: string;
  motif: string;
  compteProvision: { numero: string; libelle: string };
  client?: { nom: string; prenom: string } | null;
  fournisseur?: { nom: string } | null;
  immobilisation?: { designation: string } | null;
  mouvements: { id: number; type: "DOTATION" | "REPRISE"; montant: number | string; date: string }[];
}

const TYPE_LABELS: Record<TypeProvision, string> = {
  PROVISION_RISQUE_CHARGE: "Provision pour risques et charges",
  DEPRECIATION_STOCK: "Dépréciation de stock",
  DEPRECIATION_CLIENT: "Dépréciation de créance client",
  DEPRECIATION_IMMOBILISATION: "Dépréciation d'immobilisation",
};
const STATUT_COLORS: Record<StatutProvision, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  PARTIELLEMENT_REPRISE: "bg-amber-50 text-amber-700",
  SOLDEE: "bg-slate-100 text-slate-500",
};

const PROVISION_VIDE = {
  libelle: "", type: "PROVISION_RISQUE_CHARGE" as TypeProvision,
  compteProvisionNumero: "", compteDotationNumero: "", compteRepriseNumero: "",
  montantInitial: "", motif: "", dateConstitution: new Date().toISOString().slice(0, 10),
};

export default function ProvisionsPage() {
  const [filterType, setFilterType] = useState("");
  const [filterStatut, setFilterStatut] = useState("");

  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (filterType) p.set("type", filterType);
    if (filterStatut) p.set("statut", filterStatut);
    const qs = p.toString();
    return `/api/comptable/provisions${qs ? `?${qs}` : ""}`;
  }, [filterType, filterStatut]);

  const { data, loading, refetch } = useApi<{ data: ProvisionEntry[] }>(url);

  const [showAdd, setShowAdd] = useState(false);
  const [newProvision, setNewProvision] = useState(PROVISION_VIDE);
  const { mutate: creerProvision, loading: creating } = useMutation<unknown, object>(
    "/api/comptable/provisions", "POST", { successMessage: "Provision créée", invalidate: "/api/comptable/provisions" }
  );
  async function handleCreer() {
    const res = await creerProvision({ ...newProvision, montantInitial: Number(newProvision.montantInitial) });
    if (res) { setShowAdd(false); setNewProvision(PROVISION_VIDE); refetch(); }
  }

  // ── Dotation / reprise ────────────────────────────────────────────────
  const [mouvementModal, setMouvementModal] = useState<{ provisionId: number; type: "doter" | "reprendre" } | null>(null);
  const [mouvementMontant, setMouvementMontant] = useState("");
  const [mouvementDate, setMouvementDate] = useState(() => new Date().toISOString().slice(0, 10));
  const mouvementActionRef = useRef<{ provisionId: number; type: "doter" | "reprendre" } | null>(null);
  const { mutate: doterReprendreApi, loading: mouvementLoading } = useMutation<unknown, object>(
    () => `/api/comptable/provisions/${mouvementActionRef.current?.provisionId}/${mouvementActionRef.current?.type}`, "POST",
  );

  function ouvrirMouvement(provisionId: number, type: "doter" | "reprendre") {
    setMouvementModal({ provisionId, type });
    setMouvementMontant("");
    setMouvementDate(new Date().toISOString().slice(0, 10));
  }
  async function handleConfirmerMouvement() {
    if (!mouvementModal || !mouvementMontant) return;
    mouvementActionRef.current = mouvementModal;
    const res = await doterReprendreApi({ montant: Number(mouvementMontant), date: mouvementDate });
    if (res) { setMouvementModal(null); refetch(); }
  }

  const provisions = data?.data ?? [];

  return (
    <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldAlert className="text-emerald-600" size={22} /> Provisions & dépréciations
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">Provisions pour risques/charges et dépréciations stock/client/immobilisation.</p>
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
            <option value="ACTIVE">Active</option>
            <option value="PARTIELLEMENT_REPRISE">Partiellement reprise</option>
            <option value="SOLDEE">Soldée</option>
          </select>
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">
            <PlusCircle size={15} /> Nouvelle provision
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-emerald-200">
          <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><PlusCircle size={16} className="text-emerald-600" /> Nouvelle provision</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Libellé *</label>
              <input value={newProvision.libelle} onChange={(e) => setNewProvision(p => ({ ...p, libelle: e.target.value }))}
                placeholder="ex: Litige client X" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Type *</label>
              <select value={newProvision.type} onChange={(e) => setNewProvision(p => ({ ...p, type: e.target.value as TypeProvision }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Compte de provision *</label>
              <input value={newProvision.compteProvisionNumero} onChange={(e) => setNewProvision(p => ({ ...p, compteProvisionNumero: e.target.value }))}
                placeholder="ex: 191" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Compte de dotation *</label>
              <input value={newProvision.compteDotationNumero} onChange={(e) => setNewProvision(p => ({ ...p, compteDotationNumero: e.target.value }))}
                placeholder="ex: 691" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Compte de reprise *</label>
              <input value={newProvision.compteRepriseNumero} onChange={(e) => setNewProvision(p => ({ ...p, compteRepriseNumero: e.target.value }))}
                placeholder="ex: 786" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Montant initial *</label>
              <input type="number" value={newProvision.montantInitial} onChange={(e) => setNewProvision(p => ({ ...p, montantInitial: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 [appearance:textfield]" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Date de constitution *</label>
              <input type="date" value={newProvision.dateConstitution} onChange={(e) => setNewProvision(p => ({ ...p, dateConstitution: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div className="col-span-2 md:col-span-3">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Motif *</label>
              <input value={newProvision.motif} onChange={(e) => setNewProvision(p => ({ ...p, motif: e.target.value }))}
                placeholder="ex: Risque de non-recouvrement suite à contentieux" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Annuler</button>
            <button onClick={handleCreer}
              disabled={creating || !newProvision.libelle || !newProvision.compteProvisionNumero || !newProvision.compteDotationNumero || !newProvision.compteRepriseNumero || !newProvision.montantInitial || !newProvision.motif}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
              {creating ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />} Créer
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12"><div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Libellé</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase hidden md:table-cell">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase hidden lg:table-cell">Compte</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Solde actuel</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Statut</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {provisions.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-slate-800 font-medium">{p.libelle}</p>
                    <p className="text-xs text-slate-400">{formatDateShort(p.dateConstitution)} · {p.motif}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{TYPE_LABELS[p.type]}</td>
                  <td className="px-4 py-3 font-mono text-xs text-emerald-700 hidden lg:table-cell">{p.compteProvision.numero}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(Number(p.montantActuel))}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUT_COLORS[p.statut]}`}>{p.statut}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => ouvrirMouvement(p.id, "doter")} disabled={p.statut === "SOLDEE"}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40">
                        <TrendingUp size={13} /> Doter
                      </button>
                      <button onClick={() => ouvrirMouvement(p.id, "reprendre")} disabled={p.statut === "SOLDEE"}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 disabled:opacity-40">
                        <TrendingDown size={13} /> Reprendre
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {provisions.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    <ShieldAlert size={32} className="mx-auto mb-2 opacity-30" />
                    <p>Aucune provision enregistrée.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {mouvementModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">{mouvementModal.type === "doter" ? "Doter la provision" : "Reprendre la provision"}</h3>
              <button onClick={() => setMouvementModal(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Montant *</label>
                <input type="number" value={mouvementMontant} onChange={(e) => setMouvementMontant(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 [appearance:textfield]" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Date</label>
                <input type="date" value={mouvementDate} onChange={(e) => setMouvementDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setMouvementModal(null)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-sm font-medium">Annuler</button>
              <button onClick={handleConfirmerMouvement} disabled={mouvementLoading || !mouvementMontant}
                className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {mouvementLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />}
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
