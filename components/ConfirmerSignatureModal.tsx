"use client";

import { useState, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import SignaturePad from "@/components/SignaturePad";

/**
 * Confirmation d'une validation (visa, approbation…) avec signature tracée facultative :
 * la confirmation vaut signature électronique (nom + date/heure enregistrés côté serveur),
 * le tracé est transmis à `onConfirm` pour être imprimé sur le document.
 */
export default function ConfirmerSignatureModal({ titre, description, libelleBouton, onConfirm, onClose }: {
  titre: string;
  description?: ReactNode;
  libelleBouton: string;
  /** Retourne true si l'action a réussi (ferme alors la fenêtre). */
  onConfirm: (signature: string | null) => Promise<boolean>;
  onClose: () => void;
}) {
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmer() {
    setBusy(true);
    try { if (await onConfirm(signature)) onClose(); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[220] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h4 className="font-bold text-slate-800 text-sm">{titre}</h4>
          <button onClick={onClose}><X size={16} className="text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          {description && <div className="text-xs text-slate-500">{description}</div>}
          <p className="text-xs text-slate-500">La confirmation vaut signature électronique (votre nom, la date et l&apos;heure sont enregistrés) ; vous pouvez aussi tracer votre signature.</p>
          <SignaturePad label="Signature (facultative)" onChange={setSignature} hauteur={120} />
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
          <button onClick={confirmer} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium disabled:opacity-50">
            {busy && <Loader2 size={13} className="animate-spin" />} {libelleBouton}
          </button>
        </div>
      </div>
    </div>
  );
}
