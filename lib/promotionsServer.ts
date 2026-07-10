import { prisma } from "@/lib/prisma";
import {
  couvreProduit, respecteRestrictions, appliquerPromotion,
  type ProduitCiblable, type ContextePromotion, type PromotionEvaluable, type ResultatPromotion,
} from "@/lib/promotions";

/**
 * Résolution des promotions en base (Catalogue §9) — SERVEUR uniquement.
 * Séparé de `lib/promotions.ts` (pur/client-safe) car ce module importe Prisma.
 */

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
