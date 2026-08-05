// lib/comptabilite/ecrituresBonSortie.ts
//
// Pont comptable pour les bons de sortie exceptionnels (pertes, casses, dons,
// vols, consommation interne, retours fournisseur, livraisons client hors
// vente directe/crédit — CDC Comptabilité §56). Avant ce fichier, un bon de
// sortie validé décrémentait le stock (MouvementStock) sans jamais toucher la
// comptabilité : exactement la divergence stock logiciel ≠ stock comptable que
// le CDC demande de fermer. Valorise chaque ligne au prix d'achat du produit
// et passe par le moteur central (lib/comptabilite/moteur.ts), via l'événement
// SORTIE_STOCK_EXCEPTIONNELLE paramétrable (RegleComptable.conditionTypeSortie)
// et la cascade Produit > Catégorie > Famille > Config (§52/§53).
import type { Prisma } from "@prisma/client";
import { creerEcriture, resoudreRegleComptable, type LigneMoteur } from "@/lib/comptabilite/moteur";

type TxClient = Prisma.TransactionClient;

/**
 * Comptabilise un BonSortie VALIDE non encore comptabilisé. Idempotent via
 * `BonSortie.ecritureId`. Chaque ligne résout ses propres comptes (produit >
 * catégorie > famille > config générale) ; les lignes qui retombent sur le
 * même couple de comptes sont regroupées pour ne pas multiplier les lignes
 * d'écriture inutilement.
 */
export async function comptabiliserBonSortie(tx: TxClient, bonSortieId: number, userId: number): Promise<number | null> {
  const bon = await tx.bonSortie.findUnique({
    where: { id: bonSortieId },
    include: {
      lignes: { include: { produit: { select: { prixAchat: true, categorie: true, categorieProduit: { select: { nom: true } } } } } },
    },
  });
  if (!bon) return null;
  if (bon.statut !== "VALIDE") return null;
  if (bon.ecritureId != null) return bon.ecritureId;

  const parCouple = new Map<string, { debit: string; credit: string; journal: string; montant: number }>();
  for (const l of bon.lignes) {
    if (l.produit.prixAchat == null) continue;
    const montant = l.quantite * Number(l.produit.prixAchat);
    if (montant <= 0) continue;
    const categorie = l.produit.categorieProduit?.nom ?? l.produit.categorie ?? null;
    const regle = await resoudreRegleComptable(tx, "SORTIE_STOCK_EXCEPTIONNELLE", {
      categorie, produitId: l.produitId, pointDeVenteId: bon.pointDeVenteId, typeSortie: bon.typeSortie,
    });
    if (!regle) continue;
    const cle = `${regle.compteDebitNumero}|${regle.compteCreditNumero}|${regle.journal}`;
    const existant = parCouple.get(cle);
    if (existant) existant.montant += montant;
    else parCouple.set(cle, { debit: regle.compteDebitNumero, credit: regle.compteCreditNumero, journal: regle.journal, montant });
  }
  if (parCouple.size === 0) return null;

  const lignes: LigneMoteur[] = [];
  let journal = "OD";
  for (const { debit, credit, journal: j, montant } of parCouple.values()) {
    journal = j;
    lignes.push(
      { numero: debit, debit: montant, libelle: `${bon.typeSortie} — ${bon.reference}`, pointDeVenteId: bon.pointDeVenteId },
      { numero: credit, credit: montant, libelle: `${bon.typeSortie} — ${bon.reference}`, pointDeVenteId: bon.pointDeVenteId },
    );
  }
  if (lignes.length === 0) return null;

  const ecritureId = await creerEcriture(tx, {
    reference: `SYNC-BS-${bonSortieId}`,
    date: new Date(),
    journal,
    libelle: `Sortie de stock (${bon.typeSortie}) — ${bon.reference}`,
    userId,
    lignes,
  });

  if (ecritureId != null) await tx.bonSortie.update({ where: { id: bonSortieId }, data: { ecritureId } });
  return ecritureId;
}
