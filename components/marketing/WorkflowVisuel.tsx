"use client";

import { DECLENCHEUR_LABEL, ACTION_LABEL } from "@/components/marketing/NouvelleRegleAutomatisationModal";
import { Zap, ArrowDown, Flag } from "lucide-react";

interface Etape { id: number; ordre: number; delaiJours: number; action: string; arreterSiAchatEntreTemps: boolean }

const Fleche = () => <ArrowDown className="w-4 h-4 text-slate-300 my-1" />;

const Noeud = ({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "fuchsia" | "emerald" | "orange" }) => {
  const styles: Record<string, string> = {
    slate: "bg-slate-100 border-slate-200 text-slate-700",
    fuchsia: "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    orange: "bg-orange-50 border-orange-200 text-orange-700",
  };
  return <div className={`px-3 py-2 rounded-xl border text-xs font-semibold text-center shadow-sm ${styles[tone]}`}>{children}</div>;
};

/**
 * Aperçu visuel en lecture seule d'une règle d'automatisation (CDC §20 — "prévoir
 * une interface de type" schéma à blocs/flèches). Généré depuis les étapes réelles
 * du constructeur en liste (pas un éditeur graphique drag-and-drop — le moteur ne
 * supporte qu'un enchaînement linéaire + une seule branche conditionnelle par étape,
 * "achat entretemps ?", donc un diagramme figé suffit à représenter fidèlement
 * n'importe quelle règle créée).
 */
export default function WorkflowVisuel({ declencheur, etapes }: { declencheur: string; etapes: Etape[] }) {
  const triees = [...etapes].sort((a, b) => a.ordre - b.ordre);
  return (
    <div className="flex flex-col items-center py-2">
      <Noeud tone="fuchsia">
        <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> {DECLENCHEUR_LABEL[declencheur] ?? declencheur}</span>
      </Noeud>
      {triees.map((etape, i) => (
        <div key={etape.id} className="flex flex-col items-center">
          <Fleche />
          {etape.delaiJours > 0 && <p className="text-[10px] text-slate-400 mb-1">Attendre {etape.delaiJours} jour(s)</p>}
          <Noeud>{ACTION_LABEL[etape.action] ?? etape.action}</Noeud>

          {etape.arreterSiAchatEntreTemps ? (
            <>
              <div className="flex items-start gap-8 mt-3 relative">
                <div className="absolute top-[-14px] left-1/2 -translate-x-1/2 w-[calc(50%+2rem)] border-t border-slate-200" style={{ width: "calc(100% + 2rem)" }} />
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-semibold text-emerald-600 mb-1">Achat entretemps</span>
                  <Noeud tone="emerald"><span className="flex items-center gap-1"><Flag className="w-3 h-3" /> Terminer</span></Noeud>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-semibold text-orange-600 mb-1">Pas d&apos;achat</span>
                  {i === triees.length - 1 ? (
                    <Noeud tone="orange">Fin de séquence</Noeud>
                  ) : (
                    <span className="text-[10px] text-slate-400">↓ étape suivante</span>
                  )}
                </div>
              </div>
              {i < triees.length - 1 && <div className="h-2" />}
            </>
          ) : (
            i === triees.length - 1 && (
              <>
                <Fleche />
                <Noeud tone="emerald"><span className="flex items-center gap-1"><Flag className="w-3 h-3" /> Fin de séquence</span></Noeud>
              </>
            )
          )}
        </div>
      ))}
      {triees.length === 0 && <p className="text-xs text-slate-400 mt-3">Aucune étape définie</p>}
    </div>
  );
}
