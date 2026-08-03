"use client";

import { useState } from "react";
import { HelpCircle, X } from "lucide-react";

export interface AideComptableContenu {
  titre: string;
  compte?: string;
  nature?: string;
  fonction: string;
  regle?: string;
  referentiel?: string;
  exemple?: string;
}

/** Bouton « ? Aide comptable » (CDC §59) — popover avec compte/nature/fonction/règle/référentiel/exemple. */
export default function AideComptable({ contenu }: { contenu: AideComptableContenu }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Aide comptable"
        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50"
      >
        <HelpCircle size={13} /> Aide comptable
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-50">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-slate-800 text-sm">{contenu.titre}</h4>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            </div>
            <div className="space-y-1.5 text-xs text-slate-600">
              {contenu.compte && <p><span className="font-semibold text-slate-700">Compte :</span> {contenu.compte}</p>}
              {contenu.nature && <p><span className="font-semibold text-slate-700">Nature :</span> {contenu.nature}</p>}
              <p><span className="font-semibold text-slate-700">Fonction :</span> {contenu.fonction}</p>
              {contenu.regle && <p><span className="font-semibold text-slate-700">Règle de comptabilisation :</span> {contenu.regle}</p>}
              {contenu.referentiel && <p><span className="font-semibold text-slate-700">Référentiel :</span> {contenu.referentiel}</p>}
              {contenu.exemple && <p className="italic text-slate-500 pt-1 border-t border-slate-100 mt-1"><span className="font-semibold not-italic text-slate-700">Exemple :</span> {contenu.exemple}</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
