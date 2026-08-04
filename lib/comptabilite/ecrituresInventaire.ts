// lib/comptabilite/ecrituresInventaire.ts
//
// Pont comptable pour les inventaires physiques du module Stock (InventaireSite/
// LigneInventaireSite) — écart CDC Comptabilité comblé : un inventaire validé
// n'avait jusqu'ici aucune traduction comptable (l'écart quantité système vs
// quantité constatée restait cantonné au module Stock). Valorise l'écart global
// au prix d'achat et constate la variation de stock via le moteur central
// (lib/comptabilite/moteur.ts), en passant par une règle paramétrable
// (INVENTAIRE_ECART_VALIDE) pour que le comptable puisse reconfigurer les comptes
// par défaut sans redéploiement.
import type { Prisma } from "@prisma/client";
import { creerEcriture, resoudreRegleComptable } from "@/lib/comptabilite/moteur";

type TxClient = Prisma.TransactionClient;

export interface ResultatComptabilisationInventaire {
  ecritureId: number | null;
  ecartValorise: number;
}

/**
 * Comptabilise l'écart valorisé d'un inventaire VALIDE non encore comptabilisé :
 * surplus (écart > 0) → Dr compte stock / Cr 6031 ; manquant (écart < 0) → Dr 6031
 * / Cr compte stock. Idempotent via `InventaireSite.ecritureRegularisationId`.
 */
export async function comptabiliserEcartInventaire(
  tx: TxClient,
  inventaireSiteId: number,
  userId: number,
): Promise<ResultatComptabilisationInventaire> {
  const inventaire = await tx.inventaireSite.findUnique({
    where: { id: inventaireSiteId },
    include: { lignes: { include: { produit: { select: { prixAchat: true } } } } },
  });
  if (!inventaire) throw new Error("INVENTAIRE_INTROUVABLE");
  if (inventaire.statut !== "VALIDE") throw new Error("INVENTAIRE_NON_VALIDE");
  if (inventaire.ecritureRegularisationId != null) throw new Error("INVENTAIRE_DEJA_COMPTABILISE");

  const ecartValorise = inventaire.lignes.reduce((somme, ligne) => {
    const prixAchat = ligne.produit.prixAchat != null ? Number(ligne.produit.prixAchat) : 0;
    return somme + ligne.ecart * prixAchat;
  }, 0);

  if (Math.abs(ecartValorise) < 0.01) return { ecritureId: null, ecartValorise: 0 };

  const regle = await resoudreRegleComptable(tx, "INVENTAIRE_ECART_VALIDE");
  if (!regle) return { ecritureId: null, ecartValorise };

  const montant = Math.abs(Math.round(ecartValorise * 100) / 100);
  const estSurplus = ecartValorise > 0;

  const ecritureId = await creerEcriture(tx, {
    journal: regle.journal,
    date: inventaire.dateInventaire,
    libelle: `Écart d'inventaire ${estSurplus ? "(surplus)" : "(manquant)"} — ${inventaire.reference}`,
    userId,
    reference: `SYNC-INV-${inventaireSiteId}`,
    lignes: estSurplus
      ? [
          { numero: regle.compteDebitNumero, debit: montant, libelle: `Surplus inventaire ${inventaire.reference}` },
          { numero: regle.compteCreditNumero, credit: montant, libelle: `Surplus inventaire ${inventaire.reference}` },
        ]
      : [
          { numero: regle.compteCreditNumero, debit: montant, libelle: `Manquant inventaire ${inventaire.reference}` },
          { numero: regle.compteDebitNumero, credit: montant, libelle: `Manquant inventaire ${inventaire.reference}` },
        ],
  });

  await tx.inventaireSite.update({ where: { id: inventaireSiteId }, data: { ecritureRegularisationId: ecritureId } });

  return { ecritureId, ecartValorise };
}

/** Liste les inventaires validés en attente de comptabilisation (CDC — écritures d'inventaire). */
export async function listerInventairesAComptabiliser(tx: TxClient) {
  return tx.inventaireSite.findMany({
    where: { statut: "VALIDE", ecritureRegularisationId: null },
    include: {
      pointDeVente: { select: { nom: true } },
      realisePar: { select: { nom: true, prenom: true } },
      lignes: { include: { produit: { select: { nom: true, prixAchat: true } } } },
    },
    orderBy: { dateInventaire: "desc" },
  });
}
