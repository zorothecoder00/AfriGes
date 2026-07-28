"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, PackagePlus, Calendar, Loader2 } from "lucide-react";

interface Pdv { id: number; nom: string; code: string; type: string }
interface Fournisseur { id: number; nom: string }

export default function ApprovisionnerProduitModal({ produitId, produitNom, pointDeVenteIdParDefaut, onClose, onDone }: {
  produitId: number; produitNom: string; pointDeVenteIdParDefaut?: number;
  onClose: () => void; onDone: () => void;
}) {
  const [pdvs, setPdvs] = useState<Pdv[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [pointDeVenteId, setPointDeVenteId] = useState(pointDeVenteIdParDefaut ? String(pointDeVenteIdParDefaut) : "");
  const [fournisseurId, setFournisseurId] = useState("");
  const [fournisseurNom, setFournisseurNom] = useState("");
  const [quantite, setQuantite] = useState("");
  const [tracabiliteOuverte, setTracabiliteOuverte] = useState(false);
  const [numeroLot, setNumeroLot] = useState("");
  const [dlc, setDlc] = useState("");
  const [dluo, setDluo] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/pdv?actif=true&limit=100").then((r) => r.json()).then((j) => setPdvs(j.data ?? [])).catch(() => {});
    fetch("/api/admin/catalogue/fournisseurs").then((r) => r.json()).then((j) => setFournisseurs(j.data ?? [])).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!pointDeVenteId) { toast.error("PDV / dépôt destination requis"); return; }
    const qty = Number(quantite);
    if (!qty || qty <= 0) { toast.error("Quantité invalide"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/approvisionnements", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pointDeVenteId: Number(pointDeVenteId),
          type: "FOURNISSEUR",
          fournisseurId: fournisseurId || undefined,
          fournisseurNom: fournisseurNom || undefined,
          lignes: [{
            produitId, quantite: qty,
            numeroLot: numeroLot || undefined,
            dlc: dlc || undefined,
            dluo: dluo || undefined,
          }],
          notes: notes || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || j.message || "Erreur");
      toast.success("Approvisionnement enregistré avec succès");
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[130] p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-xl relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <X size={20} />
        </button>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <PackagePlus size={18} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Approvisionner</h2>
            <p className="text-xs text-slate-400">{produitNom}</p>
          </div>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          Ajoutez du stock sur un PDV ou le dépôt central (réception fournisseur, entrée directe). Le stock est crédité immédiatement.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">PDV / Dépôt destination *</label>
            <select required value={pointDeVenteId} onChange={(e) => setPointDeVenteId(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm">
              <option value="">Choisir un PDV…</option>
              {pdvs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.type === "DEPOT_CENTRAL" ? "[Dépôt central] " : "[PDV] "}{p.nom} ({p.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fournisseur enregistré (optionnel)</label>
            <select value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm">
              <option value="">Aucun / fournisseur non enregistré…</option>
              {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
          </div>
          {!fournisseurId && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ou nom libre (optionnel)</label>
              <input type="text" placeholder="Nom du fournisseur ou de la source…"
                value={fournisseurNom} onChange={(e) => setFournisseurNom(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantité *</label>
            <div className="flex items-center gap-2">
              <input type="number" required min="1" placeholder="Qté" value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
                className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
              <button type="button" onClick={() => setTracabiliteOuverte((v) => !v)}
                title="Traçabilité lot / péremption"
                className={`p-2.5 rounded-lg transition-colors ${tracabiliteOuverte ? "text-emerald-600 bg-emerald-50" : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"}`}>
                <Calendar size={16} />
              </button>
            </div>
          </div>

          {tracabiliteOuverte && (
            <div className="grid grid-cols-3 gap-2 border border-slate-200 rounded-xl p-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">N° de lot</label>
                <input type="text" placeholder="Ex: LOT-2026-01" value={numeroLot} onChange={(e) => setNumeroLot(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">DLC</label>
                <input type="date" value={dlc} onChange={(e) => setDlc(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">DLUO</label>
                <input type="date" value={dluo} onChange={(e) => setDluo(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optionnel)</label>
            <input type="text" placeholder="Ex: Livraison hebdomadaire, lot n°12…"
              value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
          </div>

          <button type="button" onClick={handleSubmit} disabled={saving}
            className="w-full py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-60 font-medium transition-colors flex items-center justify-center gap-2">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Enregistrement…</> : <><PackagePlus size={16} /> Enregistrer l&apos;approvisionnement</>}
          </button>
        </div>
      </div>
    </div>
  );
}
