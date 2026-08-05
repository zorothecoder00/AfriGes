// lib/comptabilite/ecrituresTransfert.ts
//
// Pont comptable pour les transferts de stock inter-PDV (TransfertStock — CDC
// Comptabilité §56). Un transfert entre deux sites de la même société n'a
// aucun impact sur le compte de résultat (le stock reste au bilan) : ce n'est
// donc PAS un COGS ni une charge, mais le CDC demande quand même que le module
// stock "fournisse les données nécessaires" à la comptabilité pour les
// transferts. On comptabilise donc un mouvement neutre — même compte stock
// des deux côtés — dont seule la dimension analytique par point de vente
// bouge (Dr stock destination / Cr stock origine), pour que le solde du
// compte 311 par PDV reflète toujours le stock physique réel de chaque site.
import type { Prisma } from "@prisma/client";
import { creerEcriture, resoudreRegleComptable, type LigneMoteur } from "@/lib/comptabilite/moteur";

type TxClient = Prisma.TransactionClient;

/**
 * Comptabilise un TransfertStock RECU non encore comptabilisé. Idempotent via
 * `TransfertStock.ecritureId`. Chaque ligne résout son propre compte stock
 * (cascade produit §52/§53) ; les lignes qui retombent sur le même compte sont
 * regroupées en un seul couple Dr(destination)/Cr(origine).
 */
export async function comptabiliserTransfertRecu(tx: TxClient, transfertId: number, userId: number): Promise<number | null> {
  const transfert = await tx.transfertStock.findUnique({
    where: { id: transfertId },
    include: {
      lignes: { include: { produit: { select: { prixAchat: true, categorie: true, categorieProduit: { select: { nom: true } } } } } },
    },
  });
  if (!transfert) return null;
  if (transfert.statut !== "RECU") return null;
  if (transfert.ecritureId != null) return transfert.ecritureId;
  if (transfert.origineId == null) return null;

  const montantParCompte = new Map<string, { journal: string; montant: number }>();
  for (const l of transfert.lignes) {
    if (l.produit.prixAchat == null) continue;
    const montant = l.quantite * Number(l.produit.prixAchat);
    if (montant <= 0) continue;
    const categorie = l.produit.categorieProduit?.nom ?? l.produit.categorie ?? null;
    const regle = await resoudreRegleComptable(tx, "SORTIE_STOCK_EXCEPTIONNELLE", {
      categorie, produitId: l.produitId, pointDeVenteId: transfert.destinationId, typeSortie: "TRANSFERT_SORTANT",
    });
    // On ne retient que le "compte stock" (côté crédit du rôle par défaut,
    // symétrique des deux côtés du transfert), pas le couple débit/crédit
    // conçu pour une sortie définitive.
    const compteStock = regle?.compteCreditNumero ?? "311";
    const journal = regle?.journal ?? "OD";
    const existant = montantParCompte.get(compteStock);
    if (existant) existant.montant += montant;
    else montantParCompte.set(compteStock, { journal, montant });
  }
  if (montantParCompte.size === 0) return null;

  const lignes: LigneMoteur[] = [];
  let journal = "OD";
  for (const [compteStock, { journal: j, montant }] of montantParCompte) {
    journal = j;
    lignes.push(
      { numero: compteStock, debit: montant, libelle: `Transfert reçu ${transfert.reference}`, pointDeVenteId: transfert.destinationId },
      { numero: compteStock, credit: montant, libelle: `Transfert expédié ${transfert.reference}`, pointDeVenteId: transfert.origineId },
    );
  }
  if (lignes.length === 0) return null;

  const ecritureId = await creerEcriture(tx, {
    reference: `SYNC-TRF-${transfertId}`,
    date: new Date(),
    journal,
    libelle: `Transfert de stock — ${transfert.reference}`,
    userId,
    lignes,
  });

  if (ecritureId != null) await tx.transfertStock.update({ where: { id: transfertId }, data: { ecritureId } });
  return ecritureId;
}
