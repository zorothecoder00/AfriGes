"use client";

// Inventaire & clôture — Charges/produits constatés d'avance (page NEUVE).
// CRUD sur RegularisationAvance (lib/comptabilite/regularisationsAvance.ts) :
// constatation immédiate (sortie du 6x/7x vers 4786/4787) + échéancier mensuel
// linéaire, comptabilisé échéance par échéance via le moteur central.
import { useMemo, useRef, useState } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import { CalendarClock, PlusCircle, Save, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";

type TypeRegularisation = "CHARGE_CONSTATEE_AVANCE" | "PRODUIT_CONSTATE_AVANCE";
type StatutRegularisation = "ACTIVE" | "SOLDEE";

interface EcheanceEntry { id: number; periode: string; montant: number | string; comptabilise: boolean }
interface RegularisationEntry {
  id: number;
  libelle: string;
  type: TypeRegularisation;
  montantTotal: number | string;
  dateDebut: string;
  dateFin: string;
  statut: StatutRegularisation;
  echeances: EcheanceEntry[];
}

const TYPE_LABELS: Record<TypeRegularisation, string> = {
  CHARGE_CONSTATEE_AVANCE: "Charge constatée d'avance (CCA)",
  PRODUIT_CONSTATE_AVANCE: "Produit constaté d'avance (PCA)",
};
const STATUT_COLORS: Record<StatutRegularisation, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  SOLDEE: "bg-slate-100 text-slate-500",
};

const REGULARISATION_VIDE = {
  libelle: "", type: "CHARGE_CONSTATEE_AVANCE" as TypeRegularisation,
  compteChargeOuProduitNumero: "", compteRegularisationNumero: "",
  montantTotal: "", dateDebut: new Date().toISOString().slice(0, 10), dateFin: new Date().toISOString().slice(0, 10),
};

export default function RegularisationsPage() {
  const [filterType, setFilterType] = useState("");
  const [filterStatut, setFilterStatut] = useState("");

  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (filterType) p.set("type", filterType);
    if (filterStatut) p.set("statut", filterStatut);
    const qs = p.toString();
    return `/api/comptable/regularisations${qs ? `?${qs}` : ""}`;
  }, [filterType, filterStatut]);

  const { data, loading, refetch } = useApi<{ data: RegularisationEntry[] }>(url);

  const [showAdd, setShowAdd] = useState(false);
  const [newRegul, setNewRegul] = useState(REGULARISATION_VIDE);
  const { mutate: creerRegularisation, loading: creating } = useMutation<unknown, object>(
    "/api/comptable/regularisations", "POST", { successMessage: "Régularisation créée" }
  );
  async function handleCreer() {
    const res = await creerRegularisation({ ...newRegul, montantTotal: Number(newRegul.montantTotal) });
    if (res) { setShowAdd(false); setNewRegul(REGULARISATION_VIDE); refetch(); }
  }

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const echeanceActionRef = useRef<{ regularisationId: number; echeanceId: number } | null>(null);
  const { mutate: comptabiliserEcheanceApi, loading: comptabilisant } = useMutation<unknown, object>(
    () => `/api/comptable/regularisations/${echeanceActionRef.current?.regularisationId}/echeances/${echeanceActionRef.current?.echeanceId}/comptabiliser`,
    "POST", { successMessage: "Échéance comptabilisée" }
  );
  async function handleComptabiliserEcheance(regularisationId: number, echeanceId: number) {
    echeanceActionRef.current = { regularisationId, echeanceId };
    const res = await comptabiliserEcheanceApi({});
    if (res) refetch();
  }

  const regularisations = data?.data ?? [];

  return (
    <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarClock className="text-emerald-600" size={22} /> Charges/produits constatés d&apos;avance
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">Étalement des CCA/PCA sur leur période, échéance mensuelle par échéance mensuelle.</p>
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
            <option value="SOLDEE">Soldée</option>
          </select>
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">
            <PlusCircle size={15} /> Nouvelle régularisation
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-emerald-200">
          <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><PlusCircle size={16} className="text-emerald-600" /> Nouvelle régularisation</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Libellé *</label>
              <input value={newRegul.libelle} onChange={(e) => setNewRegul(p => ({ ...p, libelle: e.target.value }))}
                placeholder="ex: Assurance véhicule 12 mois" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Type *</label>
              <select value={newRegul.type} onChange={(e) => setNewRegul(p => ({ ...p, type: e.target.value as TypeRegularisation }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Compte charge/produit *</label>
              <input value={newRegul.compteChargeOuProduitNumero} onChange={(e) => setNewRegul(p => ({ ...p, compteChargeOuProduitNumero: e.target.value }))}
                placeholder="ex: 613 (CCA) / 706 (PCA)" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Compte de régularisation *</label>
              <input value={newRegul.compteRegularisationNumero} onChange={(e) => setNewRegul(p => ({ ...p, compteRegularisationNumero: e.target.value }))}
                placeholder="ex: 4786 (CCA) / 4787 (PCA)" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Montant total *</label>
              <input type="number" value={newRegul.montantTotal} onChange={(e) => setNewRegul(p => ({ ...p, montantTotal: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 [appearance:textfield]" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Date de début *</label>
              <input type="date" value={newRegul.dateDebut} onChange={(e) => setNewRegul(p => ({ ...p, dateDebut: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Date de fin *</label>
              <input type="date" value={newRegul.dateFin} onChange={(e) => setNewRegul(p => ({ ...p, dateFin: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Annuler</button>
            <button onClick={handleCreer}
              disabled={creating || !newRegul.libelle || !newRegul.compteChargeOuProduitNumero || !newRegul.compteRegularisationNumero || !newRegul.montantTotal || !newRegul.dateDebut || !newRegul.dateFin}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
              {creating ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />} Créer
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12"><div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /></div>
        ) : regularisations.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <CalendarClock size={32} className="mx-auto mb-2 opacity-30" />
            <p>Aucune régularisation enregistrée.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {regularisations.map((r) => {
              const soldeRestant = r.echeances.filter(e => !e.comptabilise).reduce((s, e) => s + Number(e.montant), 0);
              const expanded = expandedId === r.id;
              return (
                <div key={r.id}>
                  <button onClick={() => setExpandedId(expanded ? null : r.id)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-left">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{r.libelle}</p>
                      <p className="text-xs text-slate-400">{TYPE_LABELS[r.type]} · Total {formatCurrency(Number(r.montantTotal))} · Reste à étaler {formatCurrency(soldeRestant)}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUT_COLORS[r.statut]}`}>{r.statut}</span>
                      {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                  </button>
                  {expanded && (
                    <div className="px-4 pb-4">
                      <table className="w-full text-xs">
                        <thead className="border-b border-slate-100">
                          <tr>
                            <th className="text-left py-1.5 text-slate-500">Période</th>
                            <th className="text-right py-1.5 text-slate-500">Montant</th>
                            <th className="text-center py-1.5 text-slate-500">Statut</th>
                            <th className="text-right py-1.5 text-slate-500">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {r.echeances.map((e) => (
                            <tr key={e.id}>
                              <td className="py-1.5 font-mono text-slate-700">{e.periode}</td>
                              <td className="py-1.5 text-right text-slate-700">{formatCurrency(Number(e.montant))}</td>
                              <td className="py-1.5 text-center">
                                {e.comptabilise
                                  ? <span className="text-emerald-600 font-semibold">Comptabilisée</span>
                                  : <span className="text-amber-600 font-semibold">À comptabiliser</span>}
                              </td>
                              <td className="py-1.5 text-right">
                                {!e.comptabilise && (
                                  <button onClick={() => handleComptabiliserEcheance(r.id, e.id)} disabled={comptabilisant}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 ml-auto">
                                    <CheckCircle size={12} /> Comptabiliser
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
