/**
 * lib/ecritureAchatServer.ts — Écriture comptable automatique à la réception
 * (CDC Approvisionnement §10 "création automatique : écriture comptable").
 *
 * Avant : la génération de l'écriture ACHATS (SYSCOHADA, débit 311 Marchandises
 * / crédit 401 Fournisseurs) se faisait uniquement via une synchronisation
 * manuelle côté comptable (`/api/comptable/sync-journals`). Cette fonction
 * reprend exactement la même logique (même référence `SYNC-MST-{id}`, même
 * statut BROUILLON en attente de validation comptable) mais est appelée
 * directement dans la transaction de validation de réception, pour que
 * l'écriture existe dès la mise en stock. La synchronisation manuelle reste
 * disponible en rattrapage (elle ignore silencieusement les références déjà
 * créées, donc aucun doublon).
 */
import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

const COMPTE_MARCHANDISES = "311";
const COMPTE_FOURNISSEURS = "401";

export async function creerEcritureAchatDepuisMouvement(
  tx: TxClient,
  mouvementStockId: number,
  userId: number
): Promise<void> {
  const reference = `SYNC-MST-${mouvementStockId}`;
  const existing = await tx.ecritureComptable.findUnique({ where: { reference }, select: { id: true } });
  if (existing) return;

  const [compteMarchandises, compteFournisseurs] = await Promise.all([
    tx.compteComptable.findFirst({ where: { numero: COMPTE_MARCHANDISES, actif: true }, select: { id: true } }),
    tx.compteComptable.findFirst({ where: { numero: COMPTE_FOURNISSEURS, actif: true }, select: { id: true } }),
  ]);
  // Plan comptable pas encore paramétré (comptes 311/401 absents) : ne bloque pas
  // la réception, l'écriture sera générée plus tard par la synchronisation manuelle.
  if (!compteMarchandises || !compteFournisseurs) return;

  const mouvement = await tx.mouvementStock.findUnique({
    where: { id: mouvementStockId },
    include: { produit: { select: { nom: true, prixUnitaire: true } } },
  });
  if (!mouvement) return;

  const montant = mouvement.quantite * Number(mouvement.produit.prixUnitaire);
  if (montant <= 0) return;

  await tx.ecritureComptable.create({
    data: {
      reference,
      date: mouvement.dateMouvement,
      libelle: `Approvisionnement ${mouvement.produit.nom} ×${mouvement.quantite}${mouvement.motif ? ` — ${mouvement.motif}` : ""}`,
      journal: "ACHATS",
      statut: "BROUILLON",
      userId,
      lignes: {
        create: [
          { compteId: compteMarchandises.id, libelle: mouvement.produit.nom, debit: montant, credit: 0 },
          { compteId: compteFournisseurs.id, libelle: mouvement.produit.nom, debit: 0, credit: montant },
        ],
      },
    },
  });
}
