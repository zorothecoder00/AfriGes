/**
 * lib/paieRetenues.ts — Retenues automatiques de la paie (CDC 13.5 / 13.6).
 *
 * À la génération d'un bulletin, injecte automatiquement comme retenues :
 *   - le remboursement mensuel des prêts EN_COURS du collaborateur ;
 *   - la quote-part mensuelle des avances sur salaire APPROUVE.
 * Décrémente les soldes (`montantRestant`) et solde le prêt (SOLDE) / l'avance
 * (REMBOURSE) lorsque le restant atteint 0.
 *
 * DOIT être appelé DANS la transaction de création de la fiche : la décrémentation
 * des soldes et la création des composants sont ainsi atomiques (un rollback de la
 * fiche annule aussi les décréments). L'unicité @@unique([profilRHId,mois,annee])
 * de FichePaie empêche tout double prélèvement.
 */

import { Prisma } from "@prisma/client";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";

export interface ComposantAuto {
  type: "REMBOURSEMENT_PRET" | "AVANCE_SUR_SALAIRE";
  libelle: string;
  montant: number;
  isRetenue: true;
  ordre: number;
}

export async function appliquerRetenuesAuto(
  tx: Prisma.TransactionClient,
  profilRHId: number,
): Promise<ComposantAuto[]> {
  const composants: ComposantAuto[] = [];

  // ── Prêts en cours : mensualité (plafonnée au restant) ──────────────────────
  const prets = await tx.pretEmploye.findMany({
    where:   { profilRHId, statut: "EN_COURS", montantRestant: { gt: 0 } },
    orderBy: { createdAt: "asc" },
  });
  for (const p of prets) {
    const restant = Number(p.montantRestant);
    const retenue = Math.min(Number(p.montantMensuel), restant);
    if (retenue <= 0) continue;
    const nouveauRestant = restant - retenue;
    await tx.pretEmploye.update({
      where: { id: p.id },
      data:  { montantRestant: nouveauRestant, ...(nouveauRestant <= 0 && { statut: "SOLDE" }) },
    });
    composants.push({
      type:      "REMBOURSEMENT_PRET",
      libelle:   `Remboursement prêt${nouveauRestant <= 0 ? " (soldé)" : ` — reste ${fmt(nouveauRestant)}`}`,
      montant:   retenue,
      isRetenue: true,
      ordre:     90,
    });
  }

  // ── Avances approuvées : quote-part mensuelle (plafonnée au restant) ─────────
  const avances = await tx.avanceSalaire.findMany({
    where:   { profilRHId, statut: "APPROUVE", montantRestant: { gt: 0 } },
    orderBy: { createdAt: "asc" },
  });
  for (const a of avances) {
    const restant       = Number(a.montantRestant);
    const echeances     = Math.max(1, a.echeancesMois);
    const partMensuelle = Math.ceil(Number(a.montant) / echeances);
    const retenue       = Math.min(partMensuelle, restant);
    if (retenue <= 0) continue;
    const nouveauRestant = restant - retenue;
    await tx.avanceSalaire.update({
      where: { id: a.id },
      data:  { montantRestant: nouveauRestant, ...(nouveauRestant <= 0 && { statut: "REMBOURSE" }) },
    });
    composants.push({
      type:      "AVANCE_SUR_SALAIRE",
      libelle:   `Retenue avance sur salaire${nouveauRestant <= 0 ? " (soldée)" : ` — reste ${fmt(nouveauRestant)}`}`,
      montant:   retenue,
      isRetenue: true,
      ordre:     91,
    });
  }

  return composants;
}
