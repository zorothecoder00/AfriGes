"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Stamp, X } from "lucide-react";
import SignaturePad from "@/components/SignaturePad";

/**
 * Visa Président CGT d'un bordereau de remise de fonds (Direction ou RPV de l'agence) :
 * la confirmation vaut signature électronique (nom + date/heure) ; le tracé est facultatif
 * et imprimé sur le bordereau. Déclenche la clôture automatique (écriture comptable).
 */
export default function VisaBordereauModal({ id, reference, onClose, onDone }: {
  id: number; reference: string; onClose: () => void; onDone: () => void;
}) {
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function viser() {
    setBusy(true);
    try {
      const r = await fetch(`/api/tresorerie/bordereaux-remise/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "VISER_CGT", signatureVisaCGT: signature ?? undefined }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success("Visa apposé — écriture comptable générée automatiquement");
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[210] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h4 className="font-bold text-slate-800 text-sm">Visa du Président CGT — {reference}</h4>
          <button onClick={onClose}><X size={16} className="text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-500">
            Le montant dépasse le seuil : votre visa est requis avant clôture. La confirmation vaut signature
            électronique (votre nom, la date et l&apos;heure sont enregistrés) ; vous pouvez aussi tracer votre signature.
          </p>
          <SignaturePad label="Signature (facultative)" onChange={setSignature} hauteur={120} />
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
          <button onClick={viser} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-medium disabled:opacity-50">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Stamp size={13} />} Apposer le visa
          </button>
        </div>
      </div>
    </div>
  );
}
