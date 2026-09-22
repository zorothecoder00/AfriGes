/**
 * Calcul du calendrier de remboursement journalier — logique partagée entre le
 * bordereau imprimable (components/BordereauRemboursement.tsx) et la page publique
 * de suivi ouverte au scan du QR (app/suivi/[reference]).
 *
 * Règles (cf. demande métier, corrigées le 2026-09-22 — cf. mémoire) :
 *  - Montant payé : UNIQUEMENT la somme des remboursements réellement
 *    enregistrés ce jour-là (numeroJour), jamais échéance.montantPaye. Ce
 *    dernier est une allocation en cascade côté serveur (le paiement du jour
 *    ciblé remplit d'abord son échéance, le reliquat comble ensuite les plus
 *    anciennes impayées) : un seul paiement peut "étaler" un montant sur
 *    plusieurs jours suivants qui n'ont reçu aucun argent ce jour-là — l'afficher
 *    comme "payé ce jour" fabriquerait des paiements inexistants.
 *  - Solde restant : décrémenté chaque jour par le montant réellement payé si le
 *    client a remboursé, sinon par le montant prévu (amortissement théorique).
 *  - Statut : piloté par le champ serveur `echeance.statut` (reflète correctement
 *    la cascade), décorrélé du montant affiché — un jour peut être "Payé" par
 *    report d'un paiement fait un autre jour, sans montant sur CE jour. Un
 *    crédit SOLDE ne montre plus jamais de retard, même sur un jour dont
 *    l'échéance n'a pas été balayée par la clôture (durée modifiée après coup…).
 *    Un jour en retard qui a quand même reçu un paiement réel (mais partiel)
 *    est marqué PARTIEL plutôt que EN_RETARD, pour ne pas perdre l'info.
 */

export type StatutCalendrier = "PAYE" | "PARTIEL" | "EN_RETARD" | "A_VENIR";

export interface CalendrierInput {
  dureeJours: number;
  dateDebut: string;
  montantTotal: number | string;
  montantJournalier: number | string;
  /** Statut global du crédit — SOLDE force tous les jours à "Payé". */
  statutCredit: string;
  echeances: {
    numeroEcheance: number;
    dateEcheance: string;
    montantDu: number | string;
    montantPaye: number | string;
    statut: string;
  }[];
  /** Remboursements réels (hors REJETE), pour le montant payé réel par jour. */
  remboursements: {
    montant: number | string;
    numeroJour: number | null;
    dateRemboursement: string;
    statut: string;
  }[];
}

export interface CalendrierRow {
  jour: number;
  date: string; // ISO
  montantPrevu: number;
  montantPaye: number;
  soldeRestant: number;
  statut: StatutCalendrier;
}

const N = (v: number | string | null | undefined) => Number(v ?? 0);
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function buildCalendrier(input: CalendrierInput, now: Date = new Date()): CalendrierRow[] {
  const duree        = Math.max(0, input.dureeJours);
  const debut        = new Date(input.dateDebut);
  const montantTotal = N(input.montantTotal);
  const journalier   = N(input.montantJournalier);
  const dernierMontant = Number((montantTotal - journalier * (duree - 1)).toFixed(2)); // résiduel du dernier jour

  const byNum = new Map(input.echeances.map((e) => [e.numeroEcheance, e]));

  // Remboursements réels, regroupés par jour de collecte (numeroJour). Certains
  // paiements sont saisis sans renseigner le champ "Jour" (numeroJour null) —
  // plutôt que de les rendre invisibles dans le calendrier, on les rattache à
  // la date réelle où ils ont été effectivement reçus (dateRemboursement),
  // comparée à la date de l'échéance du jour : ça reste 100% réel/traçable.
  const rembByJour = new Map<number, number>();
  const rembSansJour: { montant: number; date: Date }[] = [];
  for (const r of input.remboursements) {
    if (r.statut === "REJETE") continue;
    if (r.numeroJour == null) { rembSansJour.push({ montant: N(r.montant), date: new Date(r.dateRemboursement) }); continue; }
    rembByJour.set(r.numeroJour, (rembByJour.get(r.numeroJour) ?? 0) + N(r.montant));
  }

  let cumulDecrement = 0;

  return Array.from({ length: duree }, (_, idx) => {
    const jour = idx + 1;
    const e    = byNum.get(jour);
    const dateEch = e
      ? new Date(e.dateEcheance)
      : (() => { const d = new Date(debut); d.setDate(d.getDate() + idx); return d; })();

    const montantPrevu = e ? N(e.montantDu) : (jour === duree ? dernierMontant : journalier);
    // Montant réellement reçu CE jour précis — jamais e.montantPaye (cascade serveur, cf. commentaire ci-dessus).
    const rembDateMatch = rembSansJour
      .filter((r) => startOfDay(r.date) === startOfDay(dateEch))
      .reduce((s, r) => s + r.montant, 0);
    const montantPaye = (rembByJour.get(jour) ?? 0) + rembDateMatch;

    // Amortissement affiché : réel si payé ce jour, sinon théorique (le statut
    // PAYE/EN_RETARD reste piloté par echeance.statut ci-dessous, pas par ce calcul).
    cumulDecrement += montantPaye > 0 ? montantPaye : montantPrevu;
    const soldeRestant = Math.max(0, montantTotal - cumulDecrement);

    const statutRaw   = e ? e.statut : "EN_ATTENTE";
    const estPaye      = input.statutCredit === "SOLDE" || statutRaw === "PAYE";
    const estPartiel   = !estPaye && (statutRaw === "PARTIEL" || montantPaye > 0);
    const enRetard     = !estPaye && !estPartiel && dateEch < now;
    const statut: StatutCalendrier = estPaye ? "PAYE" : estPartiel ? "PARTIEL" : enRetard ? "EN_RETARD" : "A_VENIR";

    return { jour, date: dateEch.toISOString(), montantPrevu, montantPaye, soldeRestant, statut };
  });
}
