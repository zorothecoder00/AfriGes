"use client";

// components/CreditRappelInfo.tsx
// Bloc d'identification d'un crédit, affiché dans les modales de remboursement
// (unique) pour distinguer les crédits d'un même client : référence, date de
// début (mois + jour), montant total, déjà remboursé, solde restant + barre.
// Reprend les mêmes repères que la saisie rapide multiple.
// NB : on utilise la date de DÉBUT du crédit (pas la date de création) car elle
// reflète le vrai jour du crédit, même si l'enregistrement est saisi plus tard.

import { formatCurrency, formatDate } from "@/lib/format";

const MOIS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function moisLabel(value: string | Date): string | null {
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return `${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

export function CreditRappelInfo({
  reference,
  clientNom,
  dateDebut,
  montantTotal,
  montantRembourse,
  soldeRestant,
}: {
  reference: string;
  clientNom?: string;
  /** Date de début du crédit → mois (badge) + jour (« Début le … »). */
  dateDebut?: string | Date | null;
  montantTotal: number;
  /** Si absent, déduit de montantTotal - soldeRestant. */
  montantRembourse?: number;
  soldeRestant: number;
}) {
  const total = Number(montantTotal) || 0;
  const remb = montantRembourse != null ? Number(montantRembourse) : Math.max(0, total - Number(soldeRestant));
  const pct = total > 0 ? Math.min(100, Math.round((remb / total) * 100)) : 0;
  const valide = dateDebut != null && !isNaN(new Date(dateDebut).getTime());
  const mois = valide ? moisLabel(dateDebut as string) : null;
  const debutLe = valide ? formatDate(dateDebut as string) : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {clientNom && <p className="text-sm font-semibold text-slate-800 truncate">{clientNom}</p>}
          <p className="text-xs font-mono text-slate-500">{reference}</p>
          {debutLe && <p className="text-[11px] text-slate-400 mt-0.5">Début le {debutLe}</p>}
        </div>
        {mois && (
          <span className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500">
            {mois}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total</p>
          <p className="text-xs font-bold text-slate-700">{formatCurrency(total)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Remboursé</p>
          <p className="text-xs font-bold text-emerald-600">{formatCurrency(remb)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Reste</p>
          <p className="text-xs font-bold text-rose-600">{formatCurrency(Number(soldeRestant))}</p>
        </div>
      </div>
      <div>
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : "bg-amber-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-400 text-right mt-0.5">{pct}% payé</p>
      </div>
    </div>
  );
}
