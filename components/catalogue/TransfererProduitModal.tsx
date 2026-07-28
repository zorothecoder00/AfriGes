"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, ArrowRightLeft, Loader2 } from "lucide-react";

interface Pdv { id: number; nom: string; code: string; type: string }

export default function TransfererProduitModal({ produitId, produitNom, origineParDefaut, onClose, onDone }: {
  produitId: number; produitNom: string; origineParDefaut?: number;
  onClose: () => void; onDone: () => void;
}) {
  const [pdvs, setPdvs] = useState<Pdv[]>([]);
  const [origineId, setOrigineId] = useState(origineParDefaut ? String(origineParDefaut) : "");
  const [destinationId, setDestinationId] = useState("");
  const [quantite, setQuantite] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/pdv?actif=true&limit=100").then((r) => r.json()).then((j) => setPdvs(j.data ?? [])).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!origineId || !destinationId) { toast.error("Source et destination requises"); return; }
    if (origineId === destinationId) { toast.error("L'origine et la destination doivent être différentes"); return; }
    const qty = Number(quantite);
    if (!qty || qty <= 0) { toast.error("Quantité invalide"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/transferts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origineId: Number(origineId),
          destinationId: Number(destinationId),
          lignes: [{ produitId, quantite: qty }],
          notes: notes || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || j.message || "Erreur");
      toast.success("Transfert initié avec succès");
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
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <ArrowRightLeft size={18} className="text-amber-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Transférer du stock</h2>
            <p className="text-xs text-slate-400">{produitNom}</p>
          </div>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          Le stock est immédiatement retiré du PDV source. Le personnel du PDV destination recevra une notification pour confirmer la réception.
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Source *</label>
              <select required value={origineId} onChange={(e) => setOrigineId(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm">
                <option value="">PDV source…</option>
                {pdvs.map((p) => (
                  <option key={p.id} value={p.id}>{p.type === "DEPOT_CENTRAL" ? "[Dépôt] " : ""}{p.nom}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Destination *</label>
              <select required value={destinationId} onChange={(e) => setDestinationId(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm">
                <option value="">PDV destination…</option>
                {pdvs.filter((p) => String(p.id) !== origineId).map((p) => (
                  <option key={p.id} value={p.id}>{p.type === "DEPOT_CENTRAL" ? "[Dépôt] " : ""}{p.nom}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantité *</label>
            <input type="number" required min="1" placeholder="Qté" value={quantite}
              onChange={(e) => setQuantite(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optionnel)</label>
            <input type="text" placeholder="Ex: Réapprovisionnement urgent PDV Nord…"
              value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm" />
          </div>

          <button type="button" onClick={handleSubmit} disabled={saving}
            className="w-full py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 disabled:opacity-60 font-medium transition-colors flex items-center justify-center gap-2">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Transfert en cours…</> : <><ArrowRightLeft size={16} /> Initier le transfert</>}
          </button>
        </div>
      </div>
    </div>
  );
}
