"use client";

import { useState } from "react";
import IdentiteAgent from "./IdentiteAgent";
import { PiecesUploader, type PieceBordereauUploadee } from "./PiecesBordereau";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import { X, Send, AlertTriangle } from "lucide-react";

export const DENOMINATIONS = [10000, 5000, 2000, 1000, 500, 250, 100, 50, 25, 10];
const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500";

export default function NouveauBordereauRemise({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [cotisationsEspeces, setCotisationsEspeces] = useState("");
  const [cotisationsMobileMoney, setCotisationsMobileMoney] = useState("");
  const [mobileMoneyReference, setMobileMoneyReference] = useState("");
  const [remboursements, setRemboursements] = useState("");
  const [ventes, setVentes] = useState("");
  const [venteCarnet, setVenteCarnet] = useState("");
  const [fraisLivraison, setFraisLivraison] = useState("");
  const [montantVirement, setMontantVirement] = useState("");
  const [virementReference, setVirementReference] = useState("");
  const [billetage, setBilletage] = useState<Record<number, string>>({});
  const [motifEcart, setMotifEcart] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [pieces, setPieces] = useState<PieceBordereauUploadee[]>([]);
  const { data: aff } = useApi<{ pdv: { id: number; nom: string; code: string } | null; pdvs: { id: number; nom: string; code: string }[] }>("/api/me/affectation");
  const [pdvChoisi, setPdvChoisi] = useState("");
  const pdvs = aff?.pdvs ?? [];
  const pdvId = pdvChoisi || (pdvs[0] ? String(pdvs[0].id) : "");

  const totalEspecesAttendu = (Number(cotisationsEspeces) || 0) + (Number(remboursements) || 0) + (Number(ventes) || 0) + (Number(venteCarnet) || 0) + (Number(fraisLivraison) || 0);
  const totalBilletage = DENOMINATIONS.reduce((s, d) => s + d * (Number(billetage[d]) || 0), 0);
  const ecart = totalBilletage - totalEspecesAttendu;

  const handleSubmit = async () => {
    if (Math.abs(ecart) > 0.01 && !motifEcart.trim()) { toast.error("Motif de l'écart obligatoire"); return; }
    if (Number(cotisationsMobileMoney) > 0 && !mobileMoneyReference.trim()) { toast.error("Référence Mobile Money obligatoire"); return; }
    if (Number(montantVirement) > 0 && !virementReference.trim()) { toast.error("Référence de virement obligatoire"); return; }

    if (!pdvId) { toast.error("Agence / point de dépôt obligatoire"); return; }
    if (Number(montantVirement) > 0 && !pieces.some((p) => p.nature === "RELEVE_BANCAIRE")) { toast.error("Avis de virement obligatoire en pièce jointe"); return; }

    setSaving(true);
    try {
      const r = await fetch("/api/tresorerie/bordereaux-remise", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pointDeVenteId: Number(pdvId),
          pieces,
          cotisationsEspeces: Number(cotisationsEspeces) || 0,
          cotisationsMobileMoney: Number(cotisationsMobileMoney) || 0,
          mobileMoneyReference: mobileMoneyReference || undefined,
          remboursements: Number(remboursements) || 0,
          ventes: Number(ventes) || 0,
          venteCarnet: Number(venteCarnet) || 0,
          fraisLivraison: Number(fraisLivraison) || 0,
          montantVirement: Number(montantVirement) || 0,
          virementReference: virementReference || undefined,
          lignesBilletage: DENOMINATIONS.filter((d) => Number(billetage[d]) > 0).map((d) => ({ denomination: d, nombre: Number(billetage[d]) })),
          motifEcartSoumission: motifEcart || undefined,
          notes: notes || undefined,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success("Bordereau soumis"); onCreated(j.data.id); }
      else toast.error(j.error ?? "Erreur");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouveau bordereau de remise de fonds</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          <IdentiteAgent />
          <div>
            <label className="text-xs text-slate-500">Agence / point de dépôt *</label>
            <select value={pdvId} onChange={(e) => setPdvChoisi(e.target.value)} className={inputCls}>
              {pdvs.length === 0 && <option value="">Aucune affectation</option>}
              {pdvs.map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Récapitulatif des fonds remis</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-slate-500">Cotisations espèces</label><input type="number" min="0" value={cotisationsEspeces} onChange={(e) => setCotisationsEspeces(e.target.value)} className={inputCls} /></div>
              <div>
                <label className="text-xs text-slate-500">Cotisations mobile money</label>
                <input type="number" min="0" value={cotisationsMobileMoney} onChange={(e) => setCotisationsMobileMoney(e.target.value)} className={inputCls} />
                {Number(cotisationsMobileMoney) > 0 && (
                  <>
                    <input placeholder="N° transaction" value={mobileMoneyReference} onChange={(e) => setMobileMoneyReference(e.target.value)} className={inputCls + " mt-1"} />
                    <PiecesUploader nature="RECU" label="Justificatif Mobile Money" pieces={pieces} onChange={setPieces} />
                  </>
                )}
              </div>
              <div><label className="text-xs text-slate-500">Remboursements</label><input type="number" min="0" value={remboursements} onChange={(e) => setRemboursements(e.target.value)} className={inputCls} /></div>
              <div><label className="text-xs text-slate-500">Ventes</label><input type="number" min="0" value={ventes} onChange={(e) => setVentes(e.target.value)} className={inputCls} /></div>
              <div><label className="text-xs text-slate-500">Vente de carnet</label><input type="number" min="0" value={venteCarnet} onChange={(e) => setVenteCarnet(e.target.value)} className={inputCls} /></div>
              <div><label className="text-xs text-slate-500">Frais de livraison</label><input type="number" min="0" value={fraisLivraison} onChange={(e) => setFraisLivraison(e.target.value)} className={inputCls} /></div>
              <div>
                <label className="text-xs text-slate-500">Virement / dépôt direct (hors billetage)</label>
                <input type="number" min="0" value={montantVirement} onChange={(e) => setMontantVirement(e.target.value)} className={inputCls} />
                {Number(montantVirement) > 0 && (
                  <>
                    <input placeholder="Référence virement" value={virementReference} onChange={(e) => setVirementReference(e.target.value)} className={inputCls + " mt-1"} />
                    <PiecesUploader nature="RELEVE_BANCAIRE" label="Avis de virement" obligatoire pieces={pieces} onChange={setPieces} />
                  </>
                )}
              </div>
            </div>
            <p className="text-right text-sm font-bold text-slate-800 mt-2">Total espèces attendu : {totalEspecesAttendu.toLocaleString("fr-FR")} FCFA</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Billetage</p>
            <div className="grid grid-cols-2 gap-2">
              {DENOMINATIONS.map((d) => (
                <div key={d} className="flex items-center gap-2">
                  <span className="w-16 text-xs text-slate-500 flex-shrink-0">{d.toLocaleString("fr-FR")}</span>
                  <input type="number" min="0" placeholder="0" value={billetage[d] ?? ""} onChange={(e) => setBilletage((prev) => ({ ...prev, [d]: e.target.value }))} className={inputCls} />
                </div>
              ))}
            </div>
            <p className="text-right text-sm font-bold text-slate-800 mt-2">Total billetage : {totalBilletage.toLocaleString("fr-FR")} FCFA</p>
            {Math.abs(ecart) > 0.01 && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Écart de {ecart.toLocaleString("fr-FR")} FCFA</p>
                <input placeholder="Motif de l'écart (obligatoire)" value={motifEcart} onChange={(e) => setMotifEcart(e.target.value)} className={inputCls + " mt-1"} />
              </div>
            )}
          </div>

          <div>
            <PiecesUploader nature="PIECE_CAISSE" label="Fiches journalières de collecte scannées" pieces={pieces} onChange={setPieces} />
          </div>

          <div>
            <label className="text-xs text-slate-500">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
          <button onClick={handleSubmit} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50">
            <Send className="w-4 h-4" /> Soumettre
          </button>
        </div>
      </div>
    </div>
  );
}
