// lib/comptabilite/ecrituresPack.ts
//
// Pont comptable pour les Packs AfriSime (CDC Comptabilité §57). Avant ce
// fichier, ni les versements (lib/versementPack.ts) ni les livraisons de
// produits (ReceptionProduitPack) ne passaient par le moteur comptable — un
// versement encaissé ou un pack livré ne généraient aucune écriture. Un
// versement pack est encaissé AVANT que le produit ne soit livré : ce n'est
// pas une vente mais une avance client (4191), reclassée en vente réelle
// (701 + TVA + COGS) à la livraison.
import { creerEcriture, resoudreRegleComptable, type LigneMoteur, type TxClient } from "@/lib/comptabilite/moteur";
import { resoudreComptesProduit } from "@/lib/comptabilite/comptesProduit";
import { resoudreTvaVente, decomposerTTC } from "@/lib/comptabilite/tva";

/**
 * Versement pack confirmé (cotisation initiale ou périodique) : Dr Trésorerie
 * / Cr 4191 Avances clients reçues. Référence idempotente par `versementId`.
 */
export async function ecritureVersementPackConfirme(
  tx: TxClient,
  params: {
    versementId: number;
    montant: number;
    packNom: string;
    clientNom: string;
    modePaiement?: string | null;
    userId: number;
    date?: Date;
  },
): Promise<number | null> {
  if (params.montant <= 0) return null;
  const regle = await resoudreRegleComptable(tx, "SOUSCRIPTION_PACK_VERSEMENT", { modePaiement: params.modePaiement });
  if (!regle) return null;

  return creerEcriture(tx, {
    journal: regle.journal,
    date: params.date ?? new Date(),
    libelle: `Versement pack — ${params.packNom} — ${params.clientNom}`,
    userId: params.userId,
    reference: `SYNC-PCK-VRS-${params.versementId}`,
    lignes: [
      { numero: regle.compteDebitNumero, debit: params.montant, libelle: `Encaissement versement pack ${params.packNom}` },
      { numero: regle.compteCreditNumero, credit: params.montant, libelle: `Avance sur pack ${params.packNom}` },
    ],
  });
}

/**
 * Livraison réelle des produits d'un pack (ReceptionProduitPack → LIVREE) :
 * solde l'avance (4191) et reclasse en vente réelle, ligne par ligne, via la
 * cascade produit (§52/§53) pour le compte de vente/TVA — puis constate le
 * COGS (best-effort : produit sans prix d'achat connu simplement ignoré côté
 * COGS, sans jamais bloquer la reconnaissance du chiffre d'affaires).
 * Référence idempotente par `receptionId`.
 */
export async function ecritureLivraisonPack(
  tx: TxClient,
  params: {
    receptionId: number;
    packNom: string;
    clientNom: string;
    pointDeVenteId?: number | null;
    userId: number;
    date?: Date;
    lignes: { produitId: number; quantite: number; prixUnitaire: number }[];
  },
): Promise<number | null> {
  const regle = await resoudreRegleComptable(tx, "LIVRAISON_PACK_VALIDEE", { pointDeVenteId: params.pointDeVenteId });
  if (!regle) return null;
  const pdv = params.pointDeVenteId ?? null;
  const tva = await resoudreTvaVente(tx);

  const ventesParCompte = new Map<string, number>();
  const cogsParCouple = new Map<string, { debit: string; credit: string; montant: number }>();
  let montantTotal = 0;

  for (const l of params.lignes) {
    const montantLigne = l.quantite * l.prixUnitaire;
    if (montantLigne <= 0) continue;
    montantTotal += montantLigne;

    const cp = await resoudreComptesProduit(tx, l.produitId);
    const compteVente = cp.compteVente ?? regle.compteCreditNumero;
    ventesParCompte.set(compteVente, (ventesParCompte.get(compteVente) ?? 0) + montantLigne);

    const produit = await tx.produit.findUnique({ where: { id: l.produitId }, select: { prixAchat: true } });
    if (produit?.prixAchat != null) {
      const cout = l.quantite * Number(produit.prixAchat);
      if (cout > 0) {
        const compteStock = cp.compteStock ?? "311";
        const compteVariation = cp.compteVariationStock ?? "6031";
        const cle = `${compteVariation}|${compteStock}`;
        const existant = cogsParCouple.get(cle);
        if (existant) existant.montant += cout;
        else cogsParCouple.set(cle, { debit: compteVariation, credit: compteStock, montant: cout });
      }
    }
  }
  if (montantTotal <= 0) return null;

  const lignes: LigneMoteur[] = [
    { numero: regle.compteDebitNumero, debit: montantTotal, libelle: `Solde avance — ${params.packNom}`, pointDeVenteId: pdv },
  ];

  for (const [compteVente, montant] of ventesParCompte) {
    if (tva) {
      const { montantHT, montantTVA } = decomposerTTC(montant, tva.taux);
      lignes.push(
        { numero: compteVente, credit: montantHT, libelle: `Livraison pack ${params.packNom}`, pointDeVenteId: pdv },
        { numero: tva.compteCollecteNumero, credit: montantTVA, libelle: `TVA collectée — pack ${params.packNom}`, isTva: true, tauxTva: tva.taux, montantTva: montantTVA, pointDeVenteId: pdv },
      );
    } else {
      lignes.push({ numero: compteVente, credit: montant, libelle: `Livraison pack ${params.packNom}`, pointDeVenteId: pdv });
    }
  }

  for (const { debit, credit, montant } of cogsParCouple.values()) {
    lignes.push(
      { numero: debit, debit: montant, libelle: `COGS — pack ${params.packNom}`, pointDeVenteId: pdv },
      { numero: credit, credit: montant, libelle: `COGS — pack ${params.packNom}`, pointDeVenteId: pdv },
    );
  }

  return creerEcriture(tx, {
    journal: regle.journal,
    date: params.date ?? new Date(),
    libelle: `Livraison pack — ${params.packNom} — ${params.clientNom}`,
    userId: params.userId,
    reference: `SYNC-PCK-LIV-${params.receptionId}`,
    lignes,
  });
}
