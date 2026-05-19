"use client";

import { Eye, X } from "lucide-react";
import { useViewAs } from "@/contexts/ViewAsContext";
import { getStatusLabel } from "@/lib/status";

/**
 * Bandeau sticky "Mode lecture — [Prénom Nom] ([Rôle])" + bouton sortir.
 * Affiché uniquement quand un admin est en mode viewAs.
 */
export default function ViewAsBanner() {
  const { viewAs, exitViewAs } = useViewAs();
  if (!viewAs) return null;

  return (
    <div className="sticky top-0 z-[250] flex items-center justify-between bg-amber-500 px-4 py-2 shadow-md">
      <div className="flex items-center gap-2 text-sm font-medium text-white">
        <Eye size={15} className="shrink-0" />
        <span>
          Mode lecture —{" "}
          <span className="font-bold">
            {viewAs.prenom} {viewAs.nom}
          </span>{" "}
          <span className="opacity-80">
            ({getStatusLabel(viewAs.gestionnaireRole)})
          </span>
        </span>
      </div>
      <button
        onClick={exitViewAs}
        className="flex items-center gap-1.5 rounded-lg bg-amber-700 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-800"
      >
        <X size={13} />
        Quitter
      </button>
    </div>
  );
}
