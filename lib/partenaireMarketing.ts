import { prisma } from "@/lib/prisma";
import type { TxClient } from "@/lib/compteCourant";

/**
 * Influenceurs & Affiliés (CDC §47-49) — unifiés sous PartenaireMarketing.
 * Le lien/code unique réutilise le moteur Coupon (Phase 5) pour l'attribution
 * des ventes (§85 : pas de mécanisme de remise/tracking parallèle) : le même
 * code sert à la fois de lien traqué (clics) et, optionnellement, de coupon
 * de remise à l'achat — cohérent avec les exemples du CDC (DAVID10).
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomSuffix(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

/** Génère un code de lien d'affiliation unique (vérifie Coupon ET LienAffiliation). */
export async function genererCodeLien(prefix = "AFF"): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = `${prefix}-${randomSuffix()}`;
    const [existantLien, existantCoupon] = await Promise.all([
      prisma.lienAffiliation.findUnique({ where: { code }, select: { id: true } }),
      prisma.coupon.findUnique({ where: { code }, select: { id: true } }),
    ]);
    if (!existantLien && !existantCoupon) return code;
  }
  throw new Error("Impossible de générer un code de lien unique, réessayez");
}

/**
 * Crée un lien d'affiliation pour un partenaire. Si `remise` est fourni, un
 * Coupon portant le même code est créé en parallèle (le lien sert alors aussi
 * de code de réduction au moment de l'achat, attribution automatique via le
 * pipeline coupon existant).
 */
export async function creerLienAffiliation(
  tx: TxClient,
  opts: {
    partenaireId: number; campagneId: number | null; code: string; destinationUrl: string | null;
    creeParId: number;
    remise?: { typeRemise: "POURCENTAGE" | "MONTANT"; valeur: number; dateDebut: Date; dateFin: Date };
  },
) {
  let couponId: number | null = null;
  if (opts.remise) {
    const coupon = await tx.coupon.create({
      data: {
        code: opts.code, nom: `Affiliation — ${opts.code}`,
        typeRemise: opts.remise.typeRemise, valeur: opts.remise.valeur,
        dateDebut: opts.remise.dateDebut, dateFin: opts.remise.dateFin,
        campagneId: opts.campagneId, actif: true, creeParId: opts.creeParId,
      },
      select: { id: true },
    });
    couponId = coupon.id;
  }

  return tx.lienAffiliation.create({
    data: {
      partenaireId: opts.partenaireId, campagneId: opts.campagneId, code: opts.code,
      destinationUrl: opts.destinationUrl, couponId,
    },
    include: { coupon: { select: { id: true, code: true } } },
  });
}

export interface StatsPartenaire {
  nbClics: number;
  nbVentes: number;
  caGenere: number;
  commission: number;
  coutTotal: number;
  roi: number | null;
}

/** Statistiques d'un partenaire : clics, ventes attribuées, CA, commission, ROI. */
export async function statsPartenaire(partenaireId: number): Promise<StatsPartenaire> {
  const partenaire = await prisma.partenaireMarketing.findUniqueOrThrow({
    where: { id: partenaireId }, select: { tarif: true, commissionPct: true },
  });

  const liens = await prisma.lienAffiliation.findMany({
    where: { partenaireId }, select: { nbClics: true, couponId: true },
  });
  const nbClics = liens.reduce((s, l) => s + l.nbClics, 0);
  const couponIds = liens.map((l) => l.couponId).filter((id): id is number => id != null);

  let nbVentes = 0, caGenere = 0;
  if (couponIds.length) {
    const utilisations = await prisma.couponUtilisation.findMany({
      where: { couponId: { in: couponIds } },
      select: { vente: { select: { montantTotal: true } } },
    });
    nbVentes = utilisations.length;
    caGenere = utilisations.reduce((s, u) => s + Number(u.vente?.montantTotal ?? 0), 0);
  }

  const commission = caGenere * (Number(partenaire.commissionPct) / 100);
  const coutTotal = Number(partenaire.tarif ?? 0) + commission;
  const roi = coutTotal > 0 ? ((caGenere - coutTotal) / coutTotal) * 100 : null;

  return { nbClics, nbVentes, caGenere, commission, coutTotal, roi };
}
