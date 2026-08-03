/**
 * lib/ecritureAchatServer.ts — Écriture comptable automatique à la réception
 * (CDC Approvisionnement §10 "création automatique : écriture comptable").
 *
 * Passe par le moteur de règles (`RECEPTION_ACHAT_VALIDEE`) plutôt que des
 * comptes câblés en dur : une réception à crédit (par défaut, comportement
 * historique) crédite le sous-compte auxiliaire du fournisseur (401xxx) ; une
 * réception marquée COMPTANT sur `ReceptionApprovisionnement.modeReglement`
 * crédite directement la trésorerie (Caisse/Banque selon `modePaiement`) —
 * avant cette distinction, TOUT achat était compté comme une dette fournisseur,
 * même réglé cash à la livraison.
 */
import type { Prisma } from "@prisma/client";
import { creerEcriture, resoudreRegleComptable } from "@/lib/comptabilite/moteur";
import { compteAuxiliaireOuDefaut } from "@/lib/comptabilite/auxiliaire";

type TxClient = Prisma.TransactionClient;

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

  // Pas de relation Prisma déclarée entre MouvementStock et
  // ReceptionApprovisionnement (simple Int) — résolution par requête séparée.
  const reception = mouvement.receptionApproId
    ? await tx.receptionApprovisionnement.findUnique({
        where: { id: mouvement.receptionApproId },
        select: { fournisseurId: true, modeReglement: true, modePaiement: true },
      })
    : null;
  const modePaiementCtx = reception?.modeReglement === "COMPTANT" ? (reception.modePaiement ?? "ESPECES") : null;

  const regle = await resoudreRegleComptable(tx, "RECEPTION_ACHAT_VALIDEE", { modePaiement: modePaiementCtx });
  if (!regle) return;

  const compteCredit = await compteAuxiliaireOuDefaut(tx, regle.compteCreditNumero, { fournisseurId: reception?.fournisseurId });

  await creerEcriture(tx, {
    reference: `SYNC-MST-${mouvementStockId}`,
    date: mouvement.dateMouvement,
    libelle: `Approvisionnement ${mouvement.produit.nom} ×${mouvement.quantite}${mouvement.motif ? ` — ${mouvement.motif}` : ""}`,
    journal: regle.journal,
    userId,
    lignes: [
      { numero: regle.compteDebitNumero, debit: montant, libelle: mouvement.produit.nom },
      { numero: compteCredit, credit: montant, libelle: mouvement.produit.nom },
    ],
  });
}
