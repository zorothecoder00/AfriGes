"use client";

// Affichage centralisé de la marge (CDC Comptabilité §72) — Marge FCFA ET
// Marge % ensemble, partout où une vente est saisie. Consomme
// lib/margeVente.ts::calculerMargeVente ; ne recalcule jamais rien ici.
import type { MargeCalculee } from "@/lib/margeVente";
import { formatCurrency } from "@/lib/format";

export default function MargeBadge({ marge, variant = "ligne" }: { marge: MargeCalculee | null; variant?: "ligne" | "total" }) {
  if (!marge) return null;
  const positif = marge.margeTotale >= 0;
  const couleur = positif ? "text-emerald-600" : "text-red-500";

  if (variant === "total") {
    return (
      <div className="flex justify-between pt-1 border-t border-dashed border-slate-200 mt-1 text-sm">
        <span className="text-slate-500">Marge estimée</span>
        <span className={`font-semibold ${couleur}`}>
          {positif ? "+" : ""}{formatCurrency(marge.margeTotale)}
          {marge.margePct != null && <span className="font-normal text-slate-400 ml-1">({positif ? "+" : ""}{marge.margePct}%)</span>}
        </span>
      </div>
    );
  }

  return (
    <span className={`text-xs font-semibold ${couleur}`}>
      Marge : {positif ? "+" : ""}{formatCurrency(marge.margeTotale)}
      <span className="font-normal text-slate-400 ml-1">
        ({positif ? "+" : ""}{formatCurrency(marge.margeUnitaire)} / u.{marge.margePct != null ? ` · ${positif ? "+" : ""}${marge.margePct}%` : ""})
      </span>
    </span>
  );
}
