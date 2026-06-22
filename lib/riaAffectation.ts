/**
 * Bornage des opérations RIA à la fenêtre d'affectation client→investisseur.
 *
 * Règle métier : un financement / remboursement ne concerne le RIA que s'il est
 * rattaché à une affectation active ET tombe dans la fenêtre [dateDebut, dateFin]
 * de cette affectation. Les opérations antérieures (avant l'affectation) ou
 * postérieures (après la désaffectation) ne doivent pas alimenter les stats,
 * commissions ou distributions — sinon elles faussent les calculs.
 */

export type FenetreAffectation = { dateDebut: Date; dateFin: Date | null } | null | undefined;

/**
 * Vrai si `date` tombe dans la fenêtre d'affectation.
 * - affectation absente → false (opération hors périmètre RIA)
 * - date < dateDebut    → false (antérieure à l'affectation)
 * - dateFin && date > dateFin → false (postérieure à la désaffectation)
 */
export function dansFenetreAffectation(affectation: FenetreAffectation, date: Date): boolean {
  if (!affectation) return false;
  if (date < affectation.dateDebut) return false;
  if (affectation.dateFin && date > affectation.dateFin) return false;
  return true;
}
