"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, Boxes, Loader2 } from "lucide-react";

interface Pdv { id: number; nom: string; code: string; type: string }

export default function AjustementStockModal({ produitId, produitNom, stockActuel, pointDeVenteIdParDefaut, onClose, onDone }: {
  produitId: number; produitNom: string; stockActuel?: number; pointDeVenteIdParDefaut?: number;
  onClose: () => void; onDone: () => void;
}) {
  const [pdvs, setPdvs] = useState<Pdv[]>([]);
  const [pointDeVenteId, setPointDeVenteId] = useState(pointDeVenteIdParDefaut ? String(pointDeVenteIdParDefaut) : "");
  const [ajustement, setAjustement] = useState("");
  const [motif, setMotif] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/pdv?actif=true&limit=100").then((r) => r.json()).then((j) => setPdvs(j.data ?? [])).catch(() => {});
  }, []);

  const delta = Number(ajustement) || 0;
  const nouveauStock = stockActuel != null ? stockActuel + delta : null;

  const handleSubmit = async () => {
    if (!pointDeVenteId) { toast.error("PDV requis"); return; }
    if (!delta) { toast.error("Ajustement invalide"); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/stock/${produitId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ajustementStock: delta,
          motifAjustement: motif || undefined,
          pointDeVenteId: Number(pointDeVenteId),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || j.message || "Erreur");
      toast.success("Stock ajusté avec succès");
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[130] p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Boxes size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Ajuster le stock</h2>
              <p className="text-xs text-slate-400">{produitNom}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">PDV *</label>
            <select required value={pointDeVenteId} onChange={(e) => setPointDeVenteId(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
              <option value="">Choisir un PDV…</option>
              {pdvs.map((p) => (
                <option key={p.id} value={p.id}>{p.type === "DEPOT_CENTRAL" ? "[Dépôt] " : ""}{p.nom} ({p.code})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Stock actuel</label>
              <p className="text-2xl font-bold text-slate-900">{stockActuel ?? "—"}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Stock après ajustement</label>
              <p className={`text-2xl font-bold ${nouveauStock != null && nouveauStock < 0 ? "text-red-600" : "text-emerald-600"}`}>
                {nouveauStock ?? "—"}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ajustement (positif = entrée, négatif = sortie) *</label>
            <input type="number" value={ajustement} onChange={(e) => setAjustement(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Motif</label>
            <input type="text" placeholder="Ex: Inventaire, casse, correction…" value={motif} onChange={(e) => setMotif(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={saving || (nouveauStock != null && nouveauStock < 0)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
