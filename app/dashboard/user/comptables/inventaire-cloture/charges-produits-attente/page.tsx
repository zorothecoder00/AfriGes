"use client";

// Inventaire & clôture — Charges à payer / Produits à recevoir (CDC §27).
// Distinct des charges/produits constatés d'avance (page voisine "regularisations",
// étalement sur plusieurs mois) : ici la charge/le produit appartient à l'exercice
// en cours mais la facture n'est pas encore reçue/établie — constatation immédiate
// via 408/418, extournée en un seul geste dès réception de la facture réelle.
import { useMemo, useRef, useState } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { Hourglass, PlusCircle, Save, RotateCcw } from "lucide-react";

type Type = "CHARGE_A_PAYER" | "PRODUIT_A_RECEVOIR";
type Statut = "EN_ATTENTE" | "EXTOURNEE";

interface ItemEntry {
  id: number; libelle: string; type: Type; montant: number | string;
  dateConstatation: string; statut: Statut; dateExtourne: string | null;
  compteChargeOuProduit: { numero: string; libelle: string };
  compteAttente: { numero: string; libelle: string };
  creePar: { nom: string; prenom: string };
}

const TYPE_LABELS: Record<Type, string> = { CHARGE_A_PAYER: "Charge à payer", PRODUIT_A_RECEVOIR: "Produit à recevoir" };
const STATUT_COLORS: Record<Statut, string> = { EN_ATTENTE: "bg-amber-50 text-amber-700", EXTOURNEE: "bg-slate-100 text-slate-500" };

const ITEM_VIDE = {
  libelle: "", type: "CHARGE_A_PAYER" as Type,
  compteChargeOuProduitNumero: "", compteAttenteNumero: "",
  montant: "", dateConstatation: new Date().toISOString().slice(0, 10),
};

export default function ChargesProduitsAttentePage() {
  const [filterType, setFilterType] = useState("");
  const [filterStatut, setFilterStatut] = useState("");

  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (filterType) p.set("type", filterType);
    if (filterStatut) p.set("statut", filterStatut);
    const qs = p.toString();
    return `/api/comptable/charges-produits-attente${qs ? `?${qs}` : ""}`;
  }, [filterType, filterStatut]);

  const { data, loading, refetch } = useApi<{ data: ItemEntry[] }>(url);

  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState(ITEM_VIDE);
  const { mutate: creerItem, loading: creating } = useMutation<unknown, object>(
    "/api/comptable/charges-produits-attente", "POST", { successMessage: "Constatation enregistrée" }
  );
  async function handleCreer() {
    const res = await creerItem({ ...newItem, montant: Number(newItem.montant), compteAttenteNumero: newItem.compteAttenteNumero || undefined });
    if (res) { setShowAdd(false); setNewItem(ITEM_VIDE); refetch(); }
  }

  const actionIdRef = useRef<number | null>(null);
  const { mutate: extournerApi, loading: extournant } = useMutation<unknown, object>(
    () => `/api/comptable/charges-produits-attente/${actionIdRef.current}/extourner`, "POST",
    { successMessage: "Extournée" }
  );
  async function handleExtourner(id: number) {
    actionIdRef.current = id;
    const res = await extournerApi({});
    if (res) refetch();
  }

  const items = data?.data ?? [];

  return (
    <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Hourglass className="text-emerald-600" size={22} /> Charges à payer / Produits à recevoir
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Charge/produit de l&apos;exercice sans facture reçue/établie — constatation via 408/418, extournée à réception.
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
            <option value="EN_ATTENTE">En attente</option>
            <option value="EXTOURNEE">Extournée</option>
          </select>
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">
            <PlusCircle size={15} /> Nouvelle constatation
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-emerald-200">
          <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><PlusCircle size={16} className="text-emerald-600" /> Nouvelle constatation</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Libellé *</label>
              <input value={newItem.libelle} onChange={(e) => setNewItem(p => ({ ...p, libelle: e.target.value }))}
                placeholder="ex: Électricité décembre — facture non reçue" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Type *</label>
              <select value={newItem.type} onChange={(e) => setNewItem(p => ({ ...p, type: e.target.value as Type }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Compte charge/produit *</label>
              <input value={newItem.compteChargeOuProduitNumero} onChange={(e) => setNewItem(p => ({ ...p, compteChargeOuProduitNumero: e.target.value }))}
                placeholder="ex: 626 (charge) / 706 (produit)" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Compte d&apos;attente</label>
              <input value={newItem.compteAttenteNumero} onChange={(e) => setNewItem(p => ({ ...p, compteAttenteNumero: e.target.value }))}
                placeholder="défaut : 408 / 418" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Montant *</label>
              <input type="number" value={newItem.montant} onChange={(e) => setNewItem(p => ({ ...p, montant: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 [appearance:textfield]" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Date de constatation *</label>
              <input type="date" value={newItem.dateConstatation} onChange={(e) => setNewItem(p => ({ ...p, dateConstatation: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Annuler</button>
            <button onClick={handleCreer}
              disabled={creating || !newItem.libelle || !newItem.compteChargeOuProduitNumero || !newItem.montant || !newItem.dateConstatation}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
              {creating ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />} Constater
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12"><div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Hourglass size={32} className="mx-auto mb-2 opacity-30" />
            <p>Aucune charge à payer / produit à recevoir enregistré.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Libellé</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase hidden md:table-cell">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase hidden lg:table-cell">Compte</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Montant</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Date</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Statut</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it) => (
                <tr key={it.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-800">{it.libelle}</td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{TYPE_LABELS[it.type]}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs hidden lg:table-cell">{it.compteChargeOuProduit.numero} → {it.compteAttente.numero}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(Number(it.montant))}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDateShort(it.dateConstatation)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUT_COLORS[it.statut]}`}>
                      {it.statut === "EN_ATTENTE" ? "En attente" : "Extournée"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {it.statut === "EN_ATTENTE" && (
                      <button onClick={() => handleExtourner(it.id)} disabled={extournant}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-700 disabled:opacity-50 ml-auto">
                        <RotateCcw size={12} /> Extourner
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
