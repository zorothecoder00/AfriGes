"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Boxes, Trash2, Pencil, X, PackageCheck } from "lucide-react";
import { ETAT_PEREMPTION_LABEL, type EtatPeremption } from "@/lib/lotsFefo";

interface Lot {
  id: number; numeroLot: string; quantiteInitiale: number; quantite: number;
  dlc: string | null; dluo: string | null; dateReception: string; prixAchat: number | null;
  statut: string; notes: string | null;
  pointDeVente: { id: number; nom: string }; fournisseur: { id: number; nom: string } | null;
  peremption: { etat: EtatPeremption; joursRestants: number | null };
}
interface Pdv { id: number; nom: string }
interface Fournisseur { id: number; nom: string }

const ETAT_STYLE: Record<EtatPeremption, string> = {
  SANS_DLC: "bg-slate-100 text-slate-500", OK: "bg-emerald-100 text-emerald-700",
  BIENTOT: "bg-amber-100 text-amber-700", PERIME: "bg-rose-100 text-rose-700",
};
const STATUT_STYLE: Record<string, string> = {
  ACTIF: "bg-emerald-100 text-emerald-700", EPUISE: "bg-slate-100 text-slate-500",
  PERIME: "bg-rose-100 text-rose-700", RETIRE: "bg-gray-100 text-gray-400",
};

export default function LotsProduit({ produitId }: { produitId: number }) {
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdvs, setPdvs] = useState<Pdv[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const [form, setForm] = useState({ numeroLot: "", pointDeVenteId: "", quantiteInitiale: "", dlc: "", dluo: "", prixAchat: "", fournisseurId: "", notes: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/catalogue/produits/${produitId}/lots`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      setLots(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }, [produitId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/admin/pdv?actif=true&limit=100").then((r) => r.json()).then((j) => setPdvs(j.data ?? [])).catch(() => {});
    fetch("/api/admin/catalogue/fournisseurs").then((r) => r.json()).then((j) => setFournisseurs(j.data ?? [])).catch(() => {});
  }, []);

  const creer = async () => {
    if (!form.numeroLot.trim() || !form.pointDeVenteId || !form.quantiteInitiale) { toast.error("Numéro de lot, site et quantité requis"); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/catalogue/produits/${produitId}/lots`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numeroLot: form.numeroLot.trim(), pointDeVenteId: Number(form.pointDeVenteId),
          quantiteInitiale: Number(form.quantiteInitiale), dlc: form.dlc || null, dluo: form.dluo || null,
          prixAchat: form.prixAchat || null, fournisseurId: form.fournisseurId || null, notes: form.notes || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      toast.success("Lot créé");
      setForm({ numeroLot: "", pointDeVenteId: "", quantiteInitiale: "", dlc: "", dluo: "", prixAchat: "", fournisseurId: "", notes: "" });
      setShowForm(false); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusy(false); }
  };

  const ajuster = async (lot: Lot, patch: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/catalogue/lots/${lot.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      toast.success("Lot mis à jour"); setEditId(null); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusy(false); }
  };

  const retirer = async (lot: Lot) => {
    if (!confirm(`Retirer le lot « ${lot.numeroLot} » de la vente ?`)) return;
    const r = await fetch(`/api/admin/catalogue/lots/${lot.id}`, { method: "DELETE" });
    const j = await r.json();
    if (!r.ok) { toast.error(j.message ?? "Erreur"); return; }
    toast.success("Lot retiré"); load();
  };

  const field = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2"><PackageCheck className="w-4 h-4 text-blue-500" /> Lots & péremption (FEFO)</h3>
        <button onClick={() => setShowForm((s) => !s)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Nouveau lot
        </button>
      </div>

      {showForm && (
        <div className="p-5 border-b border-gray-100 bg-slate-50/50 grid grid-cols-1 md:grid-cols-3 gap-3">
          <input value={form.numeroLot} onChange={(e) => setForm({ ...form, numeroLot: e.target.value })} placeholder="N° de lot *" className={field} />
          <select value={form.pointDeVenteId} onChange={(e) => setForm({ ...form, pointDeVenteId: e.target.value })} className={field}>
            <option value="">Site / dépôt *</option>
            {pdvs.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
          <input type="number" min={1} value={form.quantiteInitiale} onChange={(e) => setForm({ ...form, quantiteInitiale: e.target.value })} placeholder="Quantité *" className={field} />
          <label className="text-xs text-gray-500">DLC (péremption)<input type="date" value={form.dlc} onChange={(e) => setForm({ ...form, dlc: e.target.value })} className={field} /></label>
          <label className="text-xs text-gray-500">DLUO (qualité)<input type="date" value={form.dluo} onChange={(e) => setForm({ ...form, dluo: e.target.value })} className={field} /></label>
          <input type="number" min={0} value={form.prixAchat} onChange={(e) => setForm({ ...form, prixAchat: e.target.value })} placeholder="Prix d'achat" className={field} />
          <select value={form.fournisseurId} onChange={(e) => setForm({ ...form, fournisseurId: e.target.value })} className={field}>
            <option value="">Fournisseur</option>
            {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
          </select>
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" className={`${field} md:col-span-2`} />
          <div className="md:col-span-3 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100">Annuler</button>
            <button onClick={creer} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Créer le lot
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
      ) : lots.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400"><Boxes className="w-8 h-8 mx-auto mb-2 opacity-40" /> Aucun lot enregistré pour ce produit.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-400 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">Lot</th>
                <th className="text-left px-4 py-2.5 font-semibold">Site</th>
                <th className="text-right px-4 py-2.5 font-semibold">Quantité</th>
                <th className="text-left px-4 py-2.5 font-semibold">DLC</th>
                <th className="text-center px-4 py-2.5 font-semibold">Péremption</th>
                <th className="text-center px-4 py-2.5 font-semibold">Statut</th>
                <th className="text-center px-4 py-2.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lots.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-800 font-mono text-xs">{l.numeroLot}</p>
                    {l.fournisseur && <p className="text-[10px] text-gray-400">{l.fournisseur.nom}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{l.pointDeVente.nom}</td>
                  <td className="px-4 py-2.5 text-right">
                    {editId === l.id ? (
                      <input type="number" min={0} defaultValue={l.quantite} className="w-20 px-2 py-1 border border-slate-200 rounded text-sm text-right"
                        onKeyDown={(e) => { if (e.key === "Enter") ajuster(l, { quantite: Number((e.target as HTMLInputElement).value) }); }}
                        id={`qte-${l.id}`} />
                    ) : (
                      <span className="font-medium">{l.quantite}<span className="text-[10px] text-gray-400"> / {l.quantiteInitiale}</span></span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{l.dlc ? new Date(l.dlc).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${ETAT_STYLE[l.peremption.etat]}`}>
                      {ETAT_PEREMPTION_LABEL[l.peremption.etat]}{l.peremption.joursRestants != null ? ` (${l.peremption.joursRestants}j)` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center"><span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUT_STYLE[l.statut] ?? ""}`}>{l.statut}</span></td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-center gap-1.5">
                      {editId === l.id ? (
                        <>
                          <button onClick={() => ajuster(l, { quantite: Number((document.getElementById(`qte-${l.id}`) as HTMLInputElement)?.value) })} disabled={busy} title="Valider" className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"><PackageCheck className="w-4 h-4" /></button>
                          <button onClick={() => setEditId(null)} title="Annuler" className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setEditId(l.id)} title="Ajuster la quantité" className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"><Pencil className="w-4 h-4" /></button>
                          {l.statut !== "RETIRE" && <button onClick={() => retirer(l)} title="Retirer" className="p-1.5 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-50">Déstockage FEFO : le lot dont la DLC est la plus proche est consommé en premier.</p>
        </div>
      )}
    </div>
  );
}
