'use client';

import { useMemo, useState } from 'react';
import { formatDate, formatCurrency } from '@/lib/format';
import {
  CheckCircle2, Clock, AlertTriangle, AlertCircle,
  ChevronDown, ChevronUp, CalendarDays, UserCheck,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface EcheanceItem {
  id: number;
  numeroEcheance: number;
  dateEcheance: string;
  montantDu: number | string;
  montantPaye: number | string;
  statut: string;
  penalite: number | string;
}

interface RemboursementItem {
  id: number;
  montant: number | string;
  dateRemboursement: string;
  modePaiement: string;
  notes: string | null;
  statut: string;
  numeroJour: number | null;
  montantAttendu: number | string | null;
  enregistrePar: { id: number; nom: string; prenom: string };
  agentCollecteur: { id: number; nom: string; prenom: string } | null;
}

export interface CreditEcheancierData {
  id: number;
  reference: string;
  statut: string;
  dateDebut: string;
  dureeJours: number;
  montantTotal: number | string;
  montantJournalier: number | string;
  echeances: EcheanceItem[];
  remboursements: RemboursementItem[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Couleur / sémantique d'une ligne d'échéancier. */
type Tone = 'paid' | 'partiel' | 'red' | 'yellow' | 'orange' | 'today' | 'future';

const TONE_ROW: Record<Tone, string> = {
  paid:    'bg-emerald-50/70 hover:bg-emerald-50',
  partiel: 'bg-blue-50/60 hover:bg-blue-50',
  red:     'bg-red-50/70 hover:bg-red-50',
  yellow:  'bg-yellow-50/70 hover:bg-yellow-50',
  orange:  'bg-orange-50/70 hover:bg-orange-50',
  today:   'bg-amber-50/60 hover:bg-amber-50',
  future:  'bg-white hover:bg-gray-50',
};

const TONE_BAR: Record<Tone, string> = {
  paid:    'bg-emerald-500',
  partiel: 'bg-blue-500',
  red:     'bg-red-500',
  yellow:  'bg-yellow-400',
  orange:  'bg-orange-400',
  today:   'bg-amber-400',
  future:  'bg-gray-200',
};

const TONE_BADGE: Record<Tone, string> = {
  paid:    'bg-emerald-100 text-emerald-700',
  partiel: 'bg-blue-100 text-blue-700',
  red:     'bg-red-100 text-red-700',
  yellow:  'bg-yellow-100 text-yellow-700',
  orange:  'bg-orange-100 text-orange-700',
  today:   'bg-amber-100 text-amber-700',
  future:  'bg-gray-100 text-gray-500',
};

function ToneIcon({ tone }: { tone: Tone }) {
  switch (tone) {
    case 'paid':    return <CheckCircle2 className="w-3.5 h-3.5" />;
    case 'partiel': return <Clock className="w-3.5 h-3.5" />;
    case 'red':     return <AlertCircle className="w-3.5 h-3.5" />;
    case 'yellow':  return <AlertTriangle className="w-3.5 h-3.5" />;
    case 'orange':  return <AlertTriangle className="w-3.5 h-3.5" />;
    case 'today':   return <Clock className="w-3.5 h-3.5" />;
    default:        return <CalendarDays className="w-3.5 h-3.5" />;
  }
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

interface Row {
  numeroJour: number;
  dateEcheance: string;
  montantDu: number;
  tone: Tone;
  label: string;
  montantPaye: number;
  agent: string | null;
  dateCollecte: string | null;
  lateDays: number;
}

const DAY_MS = 86_400_000;

/** Reproduit la génération de l'échéancier (cf. /credits/[id]/valider). */
function dateEcheanceDuJour(dateDebut: string, numeroJour: number): Date {
  const d = new Date(dateDebut);
  d.setDate(d.getDate() + (numeroJour - 1));
  return d;
}

// ─── Composant ──────────────────────────────────────────────────────────────

/**
 * Échéancier complet d'un crédit sous forme de tableau coloré.
 * - Vert    : remboursement effectivement renseigné (jour payé)
 * - Orange  : retard de 1 à 7 jours
 * - Rouge   : retard de plus de 7 jours
 * - Ambre   : échéance du jour (à régler aujourd'hui)
 * - Bleu    : remboursement partiel
 * - Neutre  : échéance à venir
 */
export default function CreditEcheancier({
  credit,
  defaultVisible = 7,
}: {
  credit: CreditEcheancierData;
  defaultVisible?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo<Row[]>(() => {
    const today = startOfDay(new Date());

    // Nombre de jours = durée du crédit (repli sur les échéances existantes)
    const nbJours = credit.dureeJours > 0 ? credit.dureeJours : credit.echeances.length;
    if (nbJours <= 0) return [];

    // Index des échéances réellement générées, par numéro de jour
    const echByJour = new Map<number, EcheanceItem>();
    for (const e of credit.echeances) echByJour.set(e.numeroEcheance, e);

    // Remboursements non rejetés, regroupés par jour de collecte
    const rembByJour = new Map<number, RemboursementItem[]>();
    for (const r of credit.remboursements) {
      if (r.statut === 'REJETE' || r.numeroJour == null) continue;
      const arr = rembByJour.get(r.numeroJour) ?? [];
      arr.push(r);
      rembByJour.set(r.numeroJour, arr);
    }

    // Montant attendu de référence + résiduel sur le dernier jour
    const montantJournalier = Number(credit.montantJournalier) || 0;
    const montantTotal = Number(credit.montantTotal) || 0;
    const residuel = montantTotal > 0
      ? Number((montantTotal - montantJournalier * nbJours).toFixed(2))
      : 0;

    // Génère TOUT l'échéancier prévisionnel, jour 1 → nbJours
    return Array.from({ length: nbJours }, (_, idx) => {
      const numeroJour = idx + 1;
      const ech = echByJour.get(numeroJour);

      // Montant attendu (dû) : échéance réelle sinon valeur calculée
      const montantDu = ech
        ? Number(ech.montantDu)
        : numeroJour === nbJours
          ? Number((montantJournalier + residuel).toFixed(2))
          : montantJournalier;

      // Date d'échéance : échéance réelle sinon calculée depuis dateDebut
      const dateEcheance = (ech?.dateEcheance ?? dateEcheanceDuJour(credit.dateDebut, numeroJour)).toString();

      const rembs = rembByJour.get(numeroJour) ?? [];
      const sommeRemb = rembs.reduce((s, r) => s + Number(r.montant), 0);
      const montantPaye = sommeRemb > 0 ? sommeRemb : Number(ech?.montantPaye ?? 0);

      const paid = ech?.statut === 'PAYE' || (montantDu > 0 && montantPaye >= montantDu);
      const partiel = !paid && montantPaye > 0;

      const echeanceDay = startOfDay(new Date(dateEcheance));
      const lateDays = Math.floor((today - echeanceDay) / DAY_MS);

      let tone: Tone;
      let label: string;
      if (paid) {
        tone = 'paid'; label = 'Payé';
      } else if (lateDays > 7) {
        tone = 'red'; label = `Retard ${lateDays}j`;
      } else if (lateDays >= 5) {
        tone = 'yellow'; label = `Retard ${lateDays}j`;
      } else if (lateDays >= 1) {
        tone = 'orange'; label = `Retard ${lateDays}j`;
      } else if (lateDays === 0) {
        tone = partiel ? 'partiel' : 'today';
        label = partiel ? 'Partiel' : "Aujourd'hui";
      } else {
        tone = partiel ? 'partiel' : 'future';
        label = partiel ? 'Partiel' : 'À venir';
      }

      // Agent collecteur le plus récent pour ce jour
      const dernier = rembs
        .slice()
        .sort((a, b) => new Date(b.dateRemboursement).getTime() - new Date(a.dateRemboursement).getTime())[0];
      const agentUser = dernier ? (dernier.agentCollecteur ?? dernier.enregistrePar) : null;

      return {
        numeroJour,
        dateEcheance,
        montantDu,
        tone,
        label,
        montantPaye,
        agent: agentUser ? `${agentUser.prenom} ${agentUser.nom}` : null,
        dateCollecte: dernier ? dernier.dateRemboursement : null,
        lateDays,
      };
    });
  }, [credit]);

  const visibleRows = expanded ? rows : rows.slice(0, defaultVisible);
  const reste = rows.length - visibleRows.length;

  if (rows.length === 0) {
    return <p className="text-xs text-gray-400 italic">Durée du crédit non définie — échéancier indisponible.</p>;
  }

  return (
    <div>
      {/* Légende */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-3 text-[11px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Payé</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-orange-400" /> Retard &lt; 5 j</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-400" /> Retard 5–7 j</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> Retard &gt; 7 j</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> Aujourd&apos;hui</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Partiel</span>
      </div>

      <div className="overflow-x-auto border border-gray-100 rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left  px-3 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Début crédit</th>
              <th className="text-left  px-3 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Jour</th>
              <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Montant payé</th>
              <th className="text-left  px-3 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Collecté par</th>
              <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {visibleRows.map((row) => (
              <tr key={row.numeroJour} className={`transition-colors ${TONE_ROW[row.tone]}`}>
                {/* Date début crédit + barre de ton */}
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className={`w-1 h-7 rounded-full flex-shrink-0 ${TONE_BAR[row.tone]}`} />
                    <span className="text-xs text-gray-500">{formatDate(credit.dateDebut)}</span>
                  </div>
                </td>

                {/* Jour spécifique (numéro + date d'échéance) */}
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className="text-xs font-semibold text-gray-700">J{row.numeroJour}</span>
                  <span className="text-xs text-gray-400 ml-2">{formatDate(row.dateEcheance)}</span>
                </td>

                {/* Montant payé / attendu */}
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  {row.montantPaye > 0 ? (
                    <span className={`text-xs font-semibold ${row.tone === 'paid' ? 'text-emerald-700' : 'text-blue-700'}`}>
                      {formatCurrency(row.montantPaye)}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                  <span className="block text-[10px] text-gray-400">
                    dû {formatCurrency(row.montantDu)}
                  </span>
                </td>

                {/* Agent collecteur */}
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {row.agent ? (
                    <span className="flex items-center gap-1 text-xs text-gray-600">
                      <UserCheck className="w-3 h-3 text-gray-400" />{row.agent}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>

                {/* Statut coloré */}
                <td className="px-3 py-2.5 text-center">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${TONE_BADGE[row.tone]}`}>
                    <ToneIcon tone={row.tone} />{row.label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dérouler / replier */}
      {rows.length > defaultVisible && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
        >
          {expanded ? (
            <><ChevronUp className="w-3.5 h-3.5" /> Replier l&apos;échéancier</>
          ) : (
            <><ChevronDown className="w-3.5 h-3.5" /> Dérouler l&apos;échéancier complet ({reste} jour{reste > 1 ? 's' : ''} de plus)</>
          )}
        </button>
      )}
    </div>
  );
}
