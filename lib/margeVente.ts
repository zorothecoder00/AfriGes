// lib/margeVente.ts
//
// Calcul de marge (CDC Comptabilité §72 : Prix vente - Coût produit = Marge
// brute, afficher Marge FCFA ET Marge %) — module pur (aucune dépendance
// Prisma), utilisable côté client et serveur. Avant ce fichier, le calcul
// était dupliqué à 5 endroits (app/dashboard/admin/ventes/page.tsx ×2,
// lib/comptabilite/rapportsGestion.ts ×3) avec des règles de garde
// légèrement différentes et jamais les deux vues (FCFA + %) ensemble sur un
// écran de vente.
export interface MargeCalculee {
  margeUnitaire: number;
  margeTotale: number;
  margePct: number | null;
}

/**
 * Retourne `null` si le prix d'achat est inconnu ou nul (coût non renseigné
 * sur la fiche produit) — jamais de marge inventée, cohérent avec le reste
 * du module comptable (CDC §75 : ne jamais générer une valeur manquante).
 */
export function calculerMargeVente(prixVente: number, prixAchat: number | null | undefined, quantite: number): MargeCalculee | null {
  if (prixAchat == null || prixAchat <= 0) return null;
  const margeUnitaire = prixVente - prixAchat;
  const margeTotale = margeUnitaire * quantite;
  const ca = prixVente * quantite;
  const margePct = ca > 0 ? Math.round((margeTotale / ca) * 1000) / 10 : null;
  return { margeUnitaire, margeTotale, margePct };
}
