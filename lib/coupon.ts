import { prisma } from "@/lib/prisma";
import type { TxClient } from "@/lib/compteCourant";
import { emitEvent } from "@/lib/systemEvents";

/**
 * Coupons marketing (CDC §35) — SERVEUR uniquement. Distinct de Promotion
 * (remise automatique par ligne, sans code) : un Coupon est un CODE saisi
 * (ex AFRI10) appliqué au panier (VenteDirecte.montantTotal). Scopé pour cette
 * phase à la vente admin (app/api/admin/ventes) — cf. mémoire projet.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I (lisibilité)

function randomSuffix(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

/** Génère un code coupon lisible et unique (retry sur collision). */
export async function genererCodeCoupon(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = `AFRI-${randomSuffix()}`;
    const existant = await prisma.coupon.findUnique({ where: { code }, select: { id: true } });
    if (!existant) return code;
  }
  throw new Error("Impossible de générer un code coupon unique, réessayez");
}

export interface ContexteCoupon {
  clientId: number | null;
  pointDeVenteId: number | null;
  produitIds: number[];
}

export interface CouponValide {
  id: number;
  code: string;
  nom: string;
  typeRemise: "POURCENTAGE" | "MONTANT" | "LOT";
  valeur: number;
}

/**
 * Valide qu'un coupon est applicable dans un contexte de vente donné.
 * Vérifie : existence/actif, fenêtre de dates, agence, produit, audience
 * (AudienceMarketingMembre), plafond global d'utilisation, non déjà utilisé
 * par ce client.
 */
export async function validerCoupon(
  code: string,
  ctx: ContexteCoupon,
  now: Date = new Date(),
): Promise<{ error: string; status: number } | { data: CouponValide }> {
  const coupon = await prisma.coupon.findUnique({
    where: { code: code.trim().toUpperCase() },
    select: {
      id: true, code: true, nom: true, typeRemise: true, valeur: true, actif: true,
      dateDebut: true, dateFin: true, utilisationMax: true,
      audienceId: true, pointDeVenteId: true, produitId: true,
      _count: { select: { utilisations: true } },
    },
  });
  if (!coupon) return { error: "Code coupon introuvable", status: 404 };
  if (!coupon.actif) return { error: "Ce coupon n'est plus actif", status: 400 };
  if (now < coupon.dateDebut || now > coupon.dateFin) return { error: "Ce coupon est hors de sa période de validité", status: 400 };
  if (coupon.pointDeVenteId != null && coupon.pointDeVenteId !== ctx.pointDeVenteId) {
    return { error: "Ce coupon n'est pas valable dans cette agence", status: 400 };
  }
  if (coupon.produitId != null && !ctx.produitIds.includes(coupon.produitId)) {
    return { error: "Ce coupon requiert la présence d'un produit spécifique dans le panier", status: 400 };
  }
  if (coupon.utilisationMax != null && coupon._count.utilisations >= coupon.utilisationMax) {
    return { error: "Ce coupon a atteint son plafond d'utilisation", status: 400 };
  }
  if (!ctx.clientId) return { error: "Un client enregistré est requis pour appliquer un coupon", status: 400 };
  if (coupon.audienceId != null) {
    const membre = await prisma.audienceMarketingMembre.findUnique({
      where: { audienceId_clientId: { audienceId: coupon.audienceId, clientId: ctx.clientId } },
      select: { clientId: true },
    });
    if (!membre) return { error: "Ce coupon n'est pas disponible pour ce client", status: 400 };
  }
  const dejaUtilise = await prisma.couponUtilisation.findUnique({
    where: { couponId_clientId: { couponId: coupon.id, clientId: ctx.clientId } },
    select: { id: true },
  });
  if (dejaUtilise) return { error: "Ce client a déjà utilisé ce coupon", status: 400 };

  return {
    data: {
      id: coupon.id, code: coupon.code, nom: coupon.nom,
      typeRemise: coupon.typeRemise, valeur: Number(coupon.valeur),
    },
  };
}

export interface ResultatCoupon {
  montantRemise: number;
  montantApres: number;
}

/**
 * Calcule la remise d'un coupon sur un montant de panier (fonction pure —
 * réutilise la logique POURCENTAGE/MONTANT de lib/promotions.ts, adaptée au
 * montant total du panier plutôt qu'à un prix unitaire). Utilisable avant
 * l'ouverture d'une transaction (ex. pour vérifier le montant payé) et à
 * l'intérieur de celle-ci (via `appliquerCoupon`) — même calcul déterministe.
 */
export function calculerRemiseCoupon(coupon: Pick<CouponValide, "typeRemise" | "valeur">, montantAvant: number): ResultatCoupon {
  let montantRemise = 0;
  if (coupon.typeRemise === "POURCENTAGE") {
    const pct = Math.min(100, Math.max(0, coupon.valeur));
    montantRemise = Math.round(montantAvant * (pct / 100));
  } else if (coupon.typeRemise === "MONTANT") {
    montantRemise = Math.min(montantAvant, Math.max(0, coupon.valeur));
  }
  // typeRemise LOT n'a pas de sens sur un panier global — traité comme 0 (garde-fou).
  return { montantRemise, montantApres: montantAvant - montantRemise };
}

/**
 * Applique un coupon déjà validé à un panier : calcule la remise et crée le
 * CouponUtilisation (dans la transaction de création de la vente).
 */
export async function appliquerCoupon(
  tx: TxClient,
  opts: { coupon: CouponValide; clientId: number; venteId: number | null; montantAvant: number },
): Promise<ResultatCoupon> {
  const resultat = calculerRemiseCoupon(opts.coupon, opts.montantAvant);

  await tx.couponUtilisation.create({
    data: {
      couponId: opts.coupon.id, clientId: opts.clientId, venteId: opts.venteId,
      montantRemise: resultat.montantRemise,
    },
  });

  // CDC §83 — coupon.used
  await emitEvent(tx, "coupon.used", { couponId: opts.coupon.id, code: opts.coupon.code, clientId: opts.clientId, venteId: opts.venteId, montantRemise: resultat.montantRemise });

  return resultat;
}
