import { prisma } from "@/lib/prisma";
import { Prisma, TypeRemisePromotion, CiblePromotion, SegmentClient } from "@prisma/client";

/**
 * Promotions commerciales (Catalogue §9).
 * Une promotion porte sur un périmètre produit (produit / catégorie / famille /
 * marque / tout le catalogue) et peut être restreinte à une agence, un segment
 * (communauté) ou un client précis, sur une période donnée. Ce module résout la
 * (les) promotion(s) applicable(s) dans un contexte d'achat et calcule le prix
 * remisé (remise fixe, en pourcentage, ou offre par lot).
 */

export const TYPES_REMISE = ["POURCENTAGE", "MONTANT", "LOT"] as const;
export const CIBLES_PROMOTION = ["PRODUIT", "CATEGORIE", "FAMILLE", "MARQUE", "TOUS"] as const;

export const TYPE_REMISE_LABEL: Record<TypeRemisePromotion, string> = {
  POURCENTAGE: "Réduction en %",
  MONTANT: "Réduction fixe (XOF)",
  LOT: "Offre par lot",
};

export const CIBLE_PROMOTION_LABEL: Record<CiblePromotion, string> = {
  PRODUIT: "Un produit",
  CATEGORIE: "Une catégorie",
  FAMILLE: "Une famille",
  MARQUE: "Une marque",
  TOUS: "Tout le catalogue",
};

// Champs du produit nécessaires pour évaluer l'éligibilité à une promotion.
export interface ProduitCiblable {
  id: number;
  categorieId: number | null;
  familleId: number | null;
  marqueId: number | null;
}

// Contexte d'achat : qui achète et où (pour filtrer les promos restreintes).
export interface ContextePromotion {
  pointDeVenteId?: number | null;
  segment?: SegmentClient | null;
  clientId?: number | null;
}

// Une promotion telle que chargée pour l'évaluation.
export interface PromotionEvaluable {
  id: number;
  code: string;
  nom: string;
  cible: CiblePromotion;
  produitId: number | null;
  categorieId: number | null;
  familleId: number | null;
  marqueId: number | null;
  typeRemise: TypeRemisePromotion;
  valeur: number;
  lotAchete: number | null;
  lotPaye: number | null;
  pointDeVenteId: number | null;
  segment: SegmentClient | null;
  clientId: number | null;
  priorite: number;
}

/** Le périmètre produit de la promo couvre-t-il ce produit ? */
export function couvreProduit(promo: PromotionEvaluable, produit: ProduitCiblable): boolean {
  switch (promo.cible) {
    case "TOUS":      return true;
    case "PRODUIT":   return promo.produitId === produit.id;
    case "CATEGORIE": return promo.categorieId != null && promo.categorieId === produit.categorieId;
    case "FAMILLE":   return promo.familleId != null && promo.familleId === produit.familleId;
    case "MARQUE":    return promo.marqueId != null && promo.marqueId === produit.marqueId;
  }
}

/** Les restrictions bénéficiaires (agence / segment / client) sont-elles satisfaites ? */
export function respecteRestrictions(promo: PromotionEvaluable, ctx: ContextePromotion): boolean {
  if (promo.pointDeVenteId != null && promo.pointDeVenteId !== ctx.pointDeVenteId) return false;
  if (promo.segment != null && promo.segment !== ctx.segment) return false;
  if (promo.clientId != null && promo.clientId !== ctx.clientId) return false;
  return true;
}

/**
 * Résout la meilleure promotion applicable à un produit dans un contexte donné.
 * Parmi les promos actives et dans leur fenêtre de dates, on retient celles qui
 * couvrent le produit et respectent les restrictions, puis on privilégie la
 * priorité la plus haute (départage : la plus récente).
 */
export async function promotionApplicable(
  produit: ProduitCiblable,
  ctx: ContextePromotion = {},
  now: Date = new Date(),
): Promise<PromotionEvaluable | null> {
  const promos = await prisma.promotion.findMany({
    where: { actif: true, dateDebut: { lte: now }, dateFin: { gte: now } },
    orderBy: [{ priorite: "desc" }, { createdAt: "desc" }],
    select: {
      id: true, code: true, nom: true, cible: true, produitId: true, categorieId: true,
      familleId: true, marqueId: true, typeRemise: true, valeur: true, lotAchete: true,
      lotPaye: true, pointDeVenteId: true, segment: true, clientId: true, priorite: true,
    },
  });

  const candidates = promos
    .map((p) => ({ ...p, valeur: Number(p.valeur) }))
    .filter((p) => couvreProduit(p, produit) && respecteRestrictions(p, ctx));

  return candidates[0] ?? null;
}

export interface ResultatPromotion {
  prixInitial: number;      // prix unitaire avant remise
  prixRemise: number;       // prix unitaire après remise (offres LOT : prix moyen unitaire)
  montantRemise: number;    // économie totale sur la quantité achetée
  quantiteFacturee: number; // quantité réellement facturée (utile pour les lots)
  promotion: { id: number; code: string; nom: string; typeRemise: TypeRemisePromotion };
}

/**
 * Applique une promotion à un prix unitaire pour une quantité donnée.
 *  - POURCENTAGE : prix × (1 - valeur/100).
 *  - MONTANT     : prix - valeur (plancher à 0).
 *  - LOT         : pour chaque `lotAchete` acheté, seuls `lotPaye` sont facturés.
 * Renvoie null si la promo est inexploitable (valeurs de lot incohérentes).
 */
export function appliquerPromotion(
  prixUnitaire: number,
  promo: PromotionEvaluable,
  quantite = 1,
): ResultatPromotion | null {
  const qte = Math.max(1, Math.floor(quantite));
  let quantiteFacturee = qte;
  let prixRemiseUnitaire = prixUnitaire;

  switch (promo.typeRemise) {
    case "POURCENTAGE": {
      const pct = Math.min(100, Math.max(0, promo.valeur));
      prixRemiseUnitaire = prixUnitaire * (1 - pct / 100);
      break;
    }
    case "MONTANT": {
      prixRemiseUnitaire = Math.max(0, prixUnitaire - Math.max(0, promo.valeur));
      break;
    }
    case "LOT": {
      const achete = promo.lotAchete ?? 0;
      const paye = promo.lotPaye ?? 0;
      if (achete <= 0 || paye < 0 || paye >= achete) return null;
      const lots = Math.floor(qte / achete);
      const reste = qte % achete;
      quantiteFacturee = lots * paye + reste;
      prixRemiseUnitaire = qte > 0 ? (quantiteFacturee * prixUnitaire) / qte : prixUnitaire;
      break;
    }
  }

  prixRemiseUnitaire = Math.round(prixRemiseUnitaire);
  const montantRemise = Math.max(0, prixUnitaire * qte - prixRemiseUnitaire * qte);

  return {
    prixInitial: prixUnitaire,
    prixRemise: prixRemiseUnitaire,
    montantRemise,
    quantiteFacturee,
    promotion: { id: promo.id, code: promo.code, nom: promo.nom, typeRemise: promo.typeRemise },
  };
}

/**
 * Prix promotionnel applicable à un produit dans un contexte donné (résolution +
 * calcul en une passe). Renvoie null si aucune promo ne s'applique.
 */
export async function prixPromotionnel(
  produit: ProduitCiblable,
  prixUnitaire: number,
  ctx: ContextePromotion = {},
  quantite = 1,
  now: Date = new Date(),
): Promise<ResultatPromotion | null> {
  const promo = await promotionApplicable(produit, ctx, now);
  if (!promo) return null;
  return appliquerPromotion(prixUnitaire, promo, quantite);
}

/** Résumé lisible de la remise d'une promotion (pour l'UI / notifications). */
export function libelleRemise(p: {
  typeRemise: TypeRemisePromotion;
  valeur: number | Prisma.Decimal;
  lotAchete: number | null;
  lotPaye: number | null;
}): string {
  const valeur = Number(p.valeur);
  switch (p.typeRemise) {
    case "POURCENTAGE": return `-${valeur} %`;
    case "MONTANT":     return `-${valeur.toLocaleString("fr-FR")} XOF`;
    case "LOT":         return `Acheté ${p.lotAchete ?? "?"}, payé ${p.lotPaye ?? "?"}`;
  }
}

/** Statut temporel d'une promotion par rapport à maintenant (pour badges UI). */
export function statutPromotion(
  p: { actif: boolean; dateDebut: Date | string; dateFin: Date | string },
  now: Date = new Date(),
): "INACTIVE" | "PROGRAMMEE" | "EN_COURS" | "EXPIREE" {
  if (!p.actif) return "INACTIVE";
  const debut = new Date(p.dateDebut);
  const fin = new Date(p.dateFin);
  if (now < debut) return "PROGRAMMEE";
  if (now > fin) return "EXPIREE";
  return "EN_COURS";
}
