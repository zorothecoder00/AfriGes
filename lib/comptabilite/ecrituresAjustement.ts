// lib/comptabilite/ecrituresAjustement.ts
//
// Pont comptable pour les ajustements de stock approuvés (DemandeAjustementStock
// — CDC Comptabilité §56). Avant ce fichier, l'approbation d'un ajustement
// mettait à jour StockSite.quantite et créait un MouvementStock AJUSTEMENT sans
// jamais toucher le compte 311/6031 : la quantité en stock changeait sans que
// la comptabilité le sache. Même logique que
// lib/comptabilite/ecrituresInventaire.ts (surplus/manquant), via l'événement
// AJUSTEMENT_STOCK_APPROUVE paramétrable et la cascade produit (§52/§53).
import type { Prisma } from "@prisma/client";
import { creerEcriture, resoudreRegleComptable } from "@/lib/comptabilite/moteur";

type TxClient = Prisma.TransactionClient;

/**
 * Comptabilise une DemandeAjustementStock APPROUVE non encore comptabilisée.
 * Idempotent via `DemandeAjustementStock.ecritureId`. Surplus (nouvelle >
 * ancienne) → Dr compte stock / Cr compte variation stock ; manquant → inverse.
 */
export async function comptabiliserAjustementStock(tx: TxClient, demandeId: number, userId: number): Promise<number | null> {
  const demande = await tx.demandeAjustementStock.findUnique({
    where: { id: demandeId },
    include: { produit: { select: { nom: true, prixAchat: true, categorie: true, categorieProduit: { select: { nom: true } } } } },
  });
  if (!demande) return null;
  if (demande.statut !== "APPROUVE") return null;
  if (demande.ecritureId != null) return demande.ecritureId;
  if (demande.produit.prixAchat == null) return null;

  const diff = demande.nouvelleQuantite - demande.ancienneQuantite;
  const montant = Math.abs(diff) * Number(demande.produit.prixAchat);
  if (montant <= 0) return null;

  const categorie = demande.produit.categorieProduit?.nom ?? demande.produit.categorie ?? null;
  const regle = await resoudreRegleComptable(tx, "AJUSTEMENT_STOCK_APPROUVE", {
    categorie, produitId: demande.produitId, pointDeVenteId: demande.pointDeVenteId,
  });
  if (!regle) return null;

  const estSurplus = diff > 0;
  const ecritureId = await creerEcriture(tx, {
    reference: `SYNC-ADJ-${demandeId}`,
    date: new Date(),
    journal: regle.journal,
    libelle: `Ajustement de stock ${estSurplus ? "(surplus)" : "(manquant)"} — ${demande.produit.nom}`,
    userId,
    lignes: estSurplus
      ? [
          { numero: regle.compteDebitNumero, debit: montant, libelle: `Ajustement stock #${demandeId}`, pointDeVenteId: demande.pointDeVenteId },
          { numero: regle.compteCreditNumero, credit: montant, libelle: `Ajustement stock #${demandeId}`, pointDeVenteId: demande.pointDeVenteId },
        ]
      : [
          { numero: regle.compteCreditNumero, debit: montant, libelle: `Ajustement stock #${demandeId}`, pointDeVenteId: demande.pointDeVenteId },
          { numero: regle.compteDebitNumero, credit: montant, libelle: `Ajustement stock #${demandeId}`, pointDeVenteId: demande.pointDeVenteId },
        ],
  });

  if (ecritureId != null) await tx.demandeAjustementStock.update({ where: { id: demandeId }, data: { ecritureId } });
  return ecritureId;
}
