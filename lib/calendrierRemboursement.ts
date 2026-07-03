/**
 * Calcul du calendrier de remboursement journalier — logique partagée entre le
 * bordereau imprimable (components/BordereauRemboursement.tsx) et la page publique
 * de suivi ouverte au scan du QR (app/suivi/[reference]).
 *
 * Règles (cf. demande métier) :
 *  - Montant payé : montant réellement remboursé ce jour-là (0 si aucun).
 *  - Solde restant : décrémenté chaque jour par le montant réellement payé si le
 *    client a remboursé, sinon par le montant prévu (amortissement théorique).
 *  - Statut : PAYE si l'échéance est soldée ; EN_RETARD si le jour est réellement
 *    passé sans paiement complet ; A_VENIR sinon (case laissée vide à l'affichage).
 */

export type StatutCalendrier = "PAYE" | "EN_RETARD" | "A_VENIR";

export interface CalendrierInput {
  dureeJours: number;
  dateDebut: string;
  montantTotal: number | string;
  montantJournalier: number | string;
  echeances: {
    numeroEcheance: number;
    dateEcheance: string;
    montantDu: number | string;
    montantPaye: number | string;
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

export function buildCalendrier(input: CalendrierInput, now: Date = new Date()): CalendrierRow[] {
  const duree        = Math.max(0, input.dureeJours);
  const debut        = new Date(input.dateDebut);
  const montantTotal = N(input.montantTotal);
  const journalier   = N(input.montantJournalier);
  const dernierMontant = Number((montantTotal - journalier * (duree - 1)).toFixed(2)); // résiduel du dernier jour

  const byNum = new Map(input.echeances.map((e) => [e.numeroEcheance, e]));
  let cumulDecrement = 0;

  return Array.from({ length: duree }, (_, idx) => {
    const jour = idx + 1;
    const e    = byNum.get(jour);
    const dateEch = e
      ? new Date(e.dateEcheance)
      : (() => { const d = new Date(debut); d.setDate(d.getDate() + idx); return d; })();

    const montantPrevu = e ? N(e.montantDu)   : (jour === duree ? dernierMontant : journalier);
    const montantPaye  = e ? N(e.montantPaye) : 0;

    cumulDecrement += montantPaye > 0 ? montantPaye : montantPrevu;
    const soldeRestant = Math.max(0, montantTotal - cumulDecrement);

    const statutRaw = e ? e.statut : "EN_ATTENTE";
    const estPaye   = statutRaw === "PAYE" || (montantPrevu > 0 && montantPaye >= montantPrevu);
    const enRetard  = !estPaye && dateEch < now;
    const statut: StatutCalendrier = estPaye ? "PAYE" : enRetard ? "EN_RETARD" : "A_VENIR";

    return { jour, date: dateEch.toISOString(), montantPrevu, montantPaye, soldeRestant, statut };
  });
}
