import { Prisma, StatutProduit } from "@prisma/client";

// Helpers de parsing partagés entre les routes catalogue (Catalogue §3).
export const STATUTS_PRODUIT = ["ACTIF", "EN_ATTENTE", "SUSPENDU", "MASQUE", "ARCHIVE"] as const;

export const strOrNull = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
export const numOrNull = (v: unknown) => (v != null && v !== "" && !isNaN(Number(v)) ? Number(v) : null);
export const decOrNull = (v: unknown) => (v != null && v !== "" && !isNaN(Number(v)) ? new Prisma.Decimal(Number(v)) : null);

/** IDs de fournisseurs secondaires (CDC Appro §5) — array d'IDs valides, dédupliqués. */
export const fournisseursSecondairesIds = (v: unknown): number[] =>
  Array.isArray(v) ? [...new Set(v.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0))] : [];

/**
 * Champs catalogue enrichis communs à la création et l'édition d'un produit
 * (Catalogue §3). `nom` et `prixUnitaire` sont gérés à part par les appelants
 * (requis à la création, optionnels à l'édition).
 */
export function buildProduitData(body: Record<string, unknown>) {
  return {
    description:     strOrNull(body.description),
    reference:       strOrNull(body.reference),
    categorie:       strOrNull(body.categorie),
    unite:           strOrNull(body.unite),
    prixAchat:       decOrNull(body.prixAchat),
    alerteStock:     Number(body.alerteStock) || 0,
    // Identification
    codeBarre:       strOrNull(body.codeBarre),
    qrCode:          strOrNull(body.qrCode),
    nomCommercial:   strOrNull(body.nomCommercial),
    statut:          STATUTS_PRODUIT.includes(body.statut as StatutProduit) ? (body.statut as StatutProduit) : undefined,
    // Classification
    familleId:         numOrNull(body.familleId),
    sousFamilleId:     numOrNull(body.sousFamilleId),
    categorieId:       numOrNull(body.categorieId),
    sousCategorieId:   numOrNull(body.sousCategorieId),
    marqueId:          numOrNull(body.marqueId),
    fournisseurPrincipalId: numOrNull(body.fournisseurPrincipalId),
    paysOrigine:       strOrNull(body.paysOrigine),
    // Caractéristiques
    poids:           decOrNull(body.poids),
    volume:          decOrNull(body.volume),
    dimensions:      strOrNull(body.dimensions),
    couleur:         strOrNull(body.couleur),
    saveur:          strOrNull(body.saveur),
    conditionnement: strOrNull(body.conditionnement),
    unitesParPalette: numOrNull(body.unitesParPalette),
    uniteVenteId:    numOrNull(body.uniteVenteId),
    uniteAchatId:    numOrNull(body.uniteAchatId),
    // Images & documents
    imagePrincipaleUrl: strOrNull(body.imagePrincipaleUrl),
    imagesSecondaires:  Array.isArray(body.imagesSecondaires) ? (body.imagesSecondaires as unknown[]).filter((x): x is string => typeof x === "string") : [],
    ficheTechniqueUrl:  strOrNull(body.ficheTechniqueUrl),
    videoUrl:           strOrNull(body.videoUrl),
  };
}
