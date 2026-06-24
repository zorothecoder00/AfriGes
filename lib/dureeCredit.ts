import { Prisma, StatutCredit, StatutEcheanceCredit } from "@prisma/client";

type TX = Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export interface CreditPourDuree {
  id: number;
  statut: StatutCredit;
  montantTotal: Prisma.Decimal | number | string;
  montantRembourse: Prisma.Decimal | number | string;
  dureeJours: number;
  dateDebut: Date;
}

/**
 * Applique une nouvelle durée et/ou date de début à un crédit (montant total inchangé).
 *
 * - Recalcule montantJournalier, dateEcheanceFin et soldeRestant (= total − déjà payé).
 * - Pour un crédit en remboursement (ACTIF / EN_RETARD), l'échéancier est régénéré et le
 *   déjà-remboursé est réimputé depuis la 1re échéance, puis le statut est recalculé
 *   (SOLDE / EN_RETARD / ACTIF). Une échéance n'est jamais marquée EN_RETARD ici, sinon
 *   elle serait exclue de l'imputation des futurs remboursements (le retard est porté
 *   par le crédit).
 *
 * Le contrôle d'accès (rôle, PDV, agent) et la vérification du statut « modifiable »
 * restent à la charge de l'appelant.
 */
export async function appliquerNouvelleDureeCredit(
  tx: TX,
  credit: CreditPourDuree,
  input: { dureeJours?: number | null; dateDebut?: string | null; garantie?: string | null; observations?: string | null },
) {
  const duree = input.dureeJours != null ? Number(input.dureeJours) : credit.dureeJours;
  if (duree < 1) throw new Error("DUREE_INVALIDE");
  const debut = input.dateDebut ? new Date(input.dateDebut) : credit.dateDebut;

  const montantTotal      = Number(credit.montantTotal);
  const dejaRembourse     = Number(credit.montantRembourse);
  const montantJournalier = Number((montantTotal / duree).toFixed(2));
  const dateEcheanceFin   = new Date(debut);
  dateEcheanceFin.setDate(dateEcheanceFin.getDate() + duree);
  const soldeRestant      = Math.max(0, Number((montantTotal - dejaRembourse).toFixed(2)));

  const updated = await tx.creditClient.update({
    where: { id: credit.id },
    data: {
      dureeJours: duree,
      dateDebut:  debut,
      montantJournalier,
      dateEcheanceFin,
      soldeRestant,
      ...(input.garantie     !== undefined && { garantie:     input.garantie }),
      ...(input.observations !== undefined && { observations: input.observations }),
    },
  });

  const estEnRemboursement = credit.statut === StatutCredit.ACTIF || credit.statut === StatutCredit.EN_RETARD;
  if (estEnRemboursement) {
    await tx.echeanceCredit.deleteMany({ where: { creditId: credit.id } });
    const residuel = Number((montantTotal - montantJournalier * duree).toFixed(2));
    const now = new Date();
    let budget = dejaRembourse;
    let resteEnRetard = false;
    const echData = Array.from({ length: duree }, (_, idx) => {
      const i = idx + 1;
      const d = new Date(debut);
      d.setDate(d.getDate() + idx);
      const montantDu = i === duree
        ? Number((montantJournalier + residuel).toFixed(2))
        : montantJournalier;
      const paye = Math.min(budget, montantDu);
      budget = Number((budget - paye).toFixed(2));
      const statut = paye >= montantDu
        ? StatutEcheanceCredit.PAYE
        : paye > 0 ? StatutEcheanceCredit.PARTIEL : StatutEcheanceCredit.EN_ATTENTE;
      if (paye < montantDu && d < now) resteEnRetard = true;
      return { creditId: credit.id, numeroEcheance: i, dateEcheance: d, montantDu, montantPaye: paye, statut };
    });
    await tx.echeanceCredit.createMany({ data: echData });

    const nouveauStatut = soldeRestant <= 0
      ? StatutCredit.SOLDE
      : resteEnRetard ? StatutCredit.EN_RETARD : StatutCredit.ACTIF;
    if (nouveauStatut !== credit.statut) {
      await tx.creditClient.update({ where: { id: credit.id }, data: { statut: nouveauStatut } });
    }
  }

  return updated;
}
