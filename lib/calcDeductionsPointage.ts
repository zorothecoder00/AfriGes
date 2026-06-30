/**
 * lib/calcDeductionsPointage.ts — Déductions de paie sur absences (CDC 13.2).
 *
 * À la génération d'un bulletin, calcule la retenue pour absences depuis les
 * pointages de la période :
 *   nb jours absents = ABSENT + 0,5 × DEMI_JOURNEE  (pointages non annulés)
 *   taux journalier  = salaireBase / jours ouvrés (lun–ven) du mois
 *   déduction        = nb jours absents × taux journalier
 *
 * Décisions métier AfriSime : base = jours ouvrés réels du mois ; les RETARDS
 * sont suivis mais NON déduits du salaire.
 */

import { Prisma } from "@prisma/client";

/** Nombre de jours ouvrés (lundi–vendredi) d'un mois. */
export function joursOuvresMois(mois: number, annee: number): number {
  let n = 0;
  const d = new Date(annee, mois - 1, 1);
  while (d.getMonth() === mois - 1) {
    const j = d.getDay();
    if (j !== 0 && j !== 6) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

export interface ComposantDeduction {
  type: "DEDUCTION_ABSENCE";
  libelle: string;
  montant: number;
  isRetenue: true;
  ordre: number;
}

/**
 * Retenue pour absences d'un collaborateur sur une période. Retourne 0 ou 1
 * composant retenue (DEDUCTION_ABSENCE).
 */
export async function calculerDeductionsAbsence(
  tx: Prisma.TransactionClient,
  profilRHId: number,
  mois: number,
  annee: number,
  salaireBase: number,
): Promise<ComposantDeduction[]> {
  if (!salaireBase || salaireBase <= 0) return [];

  const periode = { gte: new Date(annee, mois - 1, 1), lt: new Date(annee, mois, 1) };
  const [absents, demi] = await Promise.all([
    tx.pointage.count({ where: { profilRHId, annule: false, date: periode, statut: "ABSENT" } }),
    tx.pointage.count({ where: { profilRHId, annule: false, date: periode, statut: "DEMI_JOURNEE" } }),
  ]);

  const nbJoursAbsents = absents + 0.5 * demi;
  if (nbJoursAbsents <= 0) return [];

  const joursOuvres = joursOuvresMois(mois, annee) || 22; // garde-fou anti division par 0
  const tauxJour    = salaireBase / joursOuvres;
  const montant     = Math.round(nbJoursAbsents * tauxJour);
  if (montant <= 0) return [];

  const nbLabel = Number.isInteger(nbJoursAbsents) ? `${nbJoursAbsents}` : nbJoursAbsents.toFixed(1);
  return [{
    type:      "DEDUCTION_ABSENCE",
    libelle:   `Retenue absences — ${nbLabel} jour(s) sur ${joursOuvres} ouvrés`,
    montant,
    isRetenue: true,
    ordre:     92,
  }];
}
