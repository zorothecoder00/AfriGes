// lib/comptabilite/comptesProduit.ts
//
// Cascade de résolution des comptes par produit (CDC Comptabilité §52/§53) :
// Produit > CategorieProduit > FamilleProduit > ConfigurationComptableInitiale.
// Chaque compte (achat/vente/stock/variation stock/TVA achat/TVA vente/section
// analytique) est résolu INDÉPENDAMMENT des autres — un produit peut n'avoir
// que son compteStock propre et hériter de tout le reste de sa catégorie.
//
// Reproduit le même principe que lib/tarification.ts::resoudrePrix (cascade
// AGENCE > VILLE > REGION > GLOBAL) mais par spécificité de classification
// plutôt que géographique. Consommé par lib/comptabilite/moteur.ts comme
// niveau de résolution intermédiaire, entre RegleComptable (DB, le plus
// prioritaire) et REGLES_PAR_DEFAUT (codé en dur, le filet de sécurité final).
import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

export interface ComptesProduitResolus {
  compteAchat: string | null;
  compteVente: string | null;
  compteStock: string | null;
  compteVariationStock: string | null;
  compteTvaAchat: string | null;
  compteTvaVente: string | null;
  sectionAnalytiqueId: number | null;
}

const VIDE: ComptesProduitResolus = {
  compteAchat: null,
  compteVente: null,
  compteStock: null,
  compteVariationStock: null,
  compteTvaAchat: null,
  compteTvaVente: null,
  sectionAnalytiqueId: null,
};

interface NiveauComptes {
  compteAchat: string | null;
  compteVente: string | null;
  compteStock: string | null;
  compteVariationStock: string | null;
  compteTvaAchat: string | null;
  compteTvaVente: string | null;
  sectionAnalytiqueDefautId: number | null;
}

/** Premier niveau non-null pour chaque champ, dans l'ordre de spécificité fourni. */
function fusionnerParChamp(niveaux: (NiveauComptes | null)[]): ComptesProduitResolus {
  const premier = <K extends keyof NiveauComptes>(champ: K): NiveauComptes[K] | null => {
    for (const n of niveaux) {
      if (n && n[champ] != null) return n[champ];
    }
    return null;
  };
  return {
    compteAchat: premier("compteAchat"),
    compteVente: premier("compteVente"),
    compteStock: premier("compteStock"),
    compteVariationStock: premier("compteVariationStock"),
    compteTvaAchat: premier("compteTvaAchat"),
    compteTvaVente: premier("compteTvaVente"),
    sectionAnalytiqueId: premier("sectionAnalytiqueDefautId"),
  };
}

/**
 * Résout les comptes applicables à un produit selon la cascade CDC §53.
 * `produitId` null/inconnu → retourne un objet entièrement vide (pas d'erreur),
 * laissant l'appelant retomber sur REGLES_PAR_DEFAUT.
 */
export async function resoudreComptesProduit(
  tx: TxClient,
  produitId: number | null | undefined,
): Promise<ComptesProduitResolus> {
  if (produitId == null) return VIDE;

  const produit = await tx.produit.findUnique({
    where: { id: produitId },
    select: {
      compteAchat: true, compteVente: true, compteStock: true, compteVariationStock: true,
      compteTvaAchat: true, compteTvaVente: true, sectionAnalytiqueDefautId: true,
      categorieProduit: {
        select: {
          compteAchat: true, compteVente: true, compteStock: true, compteVariationStock: true,
          compteTvaAchat: true, compteTvaVente: true, sectionAnalytiqueDefautId: true,
        },
      },
      famille: {
        select: {
          compteAchat: true, compteVente: true, compteStock: true, compteVariationStock: true,
          compteTvaAchat: true, compteTvaVente: true, sectionAnalytiqueDefautId: true,
        },
      },
    },
  });
  if (!produit) return VIDE;

  const config = await tx.configurationComptableInitiale.findUnique({
    where: { id: 1 },
    select: {
      compteAchatDefaut: true, compteVenteDefaut: true, compteStockDefaut: true,
      compteVariationStockDefaut: true, compteTvaAchatDefaut: true, compteTvaVenteDefaut: true,
    },
  });
  const niveauConfig: NiveauComptes | null = config
    ? {
        compteAchat: config.compteAchatDefaut,
        compteVente: config.compteVenteDefaut,
        compteStock: config.compteStockDefaut,
        compteVariationStock: config.compteVariationStockDefaut,
        compteTvaAchat: config.compteTvaAchatDefaut,
        compteTvaVente: config.compteTvaVenteDefaut,
        sectionAnalytiqueDefautId: null,
      }
    : null;

  return fusionnerParChamp([produit, produit.categorieProduit, produit.famille, niveauConfig]);
}
