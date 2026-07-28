"use client";

import { useState } from "react";
import { toast } from "sonner";
import { X, RefreshCw } from "lucide-react";
import { useMutation } from "@/hooks/useApi";

// ═══════════════════════════════════════════════════════════════════════════
// Blocage / Consignation de stock (CDC §11) — transfert interne au site, sans
// impact sur le stock théorique total. Bloqué = litige qualité, non vendable
// temporairement. Consigné = dépôt-vente, propriété du fournisseur jusqu'à vente.
// ═══════════════════════════════════════════════════════════════════════════

type BlocageAction = "BLOQUER" | "DEBLOQUER" | "CONSIGNER" | "DECONSIGNER";

const BLOCAGE_ACTIONS: { value: BlocageAction; label: string; hint: string }[] = [
  { value: "BLOQUER", label: "Bloquer", hint: "Depuis le disponible → mis de côté (litige qualité)" },
  { value: "DEBLOQUER", label: "Débloquer", hint: "Depuis le bloqué → revient au disponible" },
  { value: "CONSIGNER", label: "Consigner", hint: "Depuis le disponible → dépôt-vente fournisseur" },
  { value: "DECONSIGNER", label: "Déconsigner", hint: "Depuis le consigné → revient au disponible" },
];

export default function BlocageStockModal({ stock, onClose, onDone }: {
  stock: { produitId: number; produitNom: string; pointDeVenteId: number; pointDeVenteNom: string; quantite: number; quantiteBloquee: number; quantiteConsignee: number };
  onClose: () => void; onDone: () => void;
}) {
  const [action, setAction] = useState<BlocageAction>("BLOQUER");
  const [quantite, setQuantite] = useState("");
  const [motif, setMotif] = useState("");

  const { mutate: appliquer, loading: saving } = useMutation<unknown, object>(
    `/api/admin/stock/${stock.produitId}`, "PUT",
    { successMessage: "Stock mis à jour" }
  );

  const plafond = action === "BLOQUER" || action === "CONSIGNER" ? stock.quantite
    : action === "DEBLOQUER" ? stock.quantiteBloquee
    : stock.quantiteConsignee;

  const handleSubmit = async () => {
    const qty = Number(quantite);
    if (!qty || qty <= 0) { toast.error("Quantité invalide"); return; }
    if (qty > plafond) { toast.error(`Quantité disponible pour cette action : ${plafond}`); return; }
    const result = await appliquer({
      pointDeVenteId: stock.pointDeVenteId,
      blocageAction: action,
      blocageQuantite: qty,
      motifAjustement: motif || undefined,
    });
    if (result !== null) onDone();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[130] p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-semibold text-slate-900">Bloquer / Consigner</h2>
            <p className="text-xs text-slate-400">{stock.produitNom} · {stock.pointDeVenteNom}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-2 text-xs text-center">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg py-2">
              <p className="font-bold text-emerald-700">{stock.quantite}</p><p className="text-emerald-600">Disponible</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg py-2">
              <p className="font-bold text-orange-700">{stock.quantiteBloquee}</p><p className="text-orange-600">Bloqué</p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg py-2">
              <p className="font-bold text-purple-700">{stock.quantiteConsignee}</p><p className="text-purple-600">Consigné</p>
            </div>
          </div>

          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Action</span>
            <select value={action} onChange={(e) => { setAction(e.target.value as BlocageAction); setQuantite(""); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500">
              {BLOCAGE_ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
            <span className="block text-[11px] text-slate-400 mt-1">{BLOCAGE_ACTIONS.find((a) => a.value === action)?.hint}</span>
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Quantité (max {plafond})</span>
            <input type="number" min="1" max={plafond} value={quantite} onChange={(e) => setQuantite(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Motif</span>
            <textarea rows={2} value={motif} onChange={(e) => setMotif(e.target.value)}
              placeholder="Ex : litige qualité fournisseur, dépôt-vente..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </label>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={saving || plafond <= 0}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : null} Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}
