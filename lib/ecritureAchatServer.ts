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
import { creerEcriture } from "@/lib/comptabilite/moteur";

type TxClient = Prisma.TransactionClient;

const COMPTE_MARCHANDISES = "311";
const COMPTE_FOURNISSEURS = "401";

export async function creerEcritureAchatDepuisMouvement(
  tx: TxClient,
  mouvementStockId: number,
  userId: number
): Promise<void> {
  const mouvement = await tx.mouvementStock.findUnique({
    where: { id: mouvementStockId },
    include: { produit: { select: { nom: true, prixUnitaire: true } } },
  });
  if (!mouvement) return;

  const montant = mouvement.quantite * Number(mouvement.produit.prixUnitaire);
  if (montant <= 0) return;

  await creerEcriture(tx, {
    reference: `SYNC-MST-${mouvementStockId}`,
    date: mouvement.dateMouvement,
    libelle: `Approvisionnement ${mouvement.produit.nom} ×${mouvement.quantite}${mouvement.motif ? ` — ${mouvement.motif}` : ""}`,
    journal: "ACHATS",
    userId,
    lignes: [
      { numero: COMPTE_MARCHANDISES, debit: montant, libelle: mouvement.produit.nom },
      { numero: COMPTE_FOURNISSEURS, credit: montant, libelle: mouvement.produit.nom },
    ],
  });
}
