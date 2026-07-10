import { prisma } from "@/lib/prisma";
import { Prisma, TypePrix, PorteePrix } from "@prisma/client";
import type { TxClient } from "@/lib/compteCourant";
import { TYPES_PRIX, TYPE_PRIX_LABEL } from "@/lib/tarificationLabels";

/**
 * Tarification flexible (Catalogue §4, Enterprise #1/#2/#6).
 * Un produit porte plusieurs lignes de prix (PrixProduit), par type/profil et,
 * optionnellement, spécifiques à une agence / ville / région. Ce module résout
 * le prix applicable dans un contexte donné et pilote le moteur de prix auto.
 *
 * NB : `TYPES_PRIX` / `TYPE_PRIX_LABEL` vivent dans `lib/tarificationLabels.ts`
 * (module pur) pour être importables côté client. On les ré-exporte ici pour ne
 * pas casser les appelants serveur existants.
 */

export { TYPES_PRIX, TYPE_PRIX_LABEL };

// Priorité de portée : plus la portée est précise, plus le prix prime.
const PRIORITE_PORTEE: Record<PorteePrix, number> = { AGENCE: 3, VILLE: 2, REGION: 1, GLOBAL: 0 };

export interface ContexteGeo {
  pointDeVenteId?: number | null;
  ville?: string | null;
  region?: string | null;
}

/** Une ligne de prix valide (active, dans sa fenêtre de dates) correspond-elle au contexte géo ? */
function correspondGeo(
  prix: { portee: PorteePrix; pointDeVenteId: number | null; ville: string | null; region: string | null },
  ctx: ContexteGeo,
): boolean {
  switch (prix.portee) {
    case "GLOBAL": return true;
    case "AGENCE": return ctx.pointDeVenteId != null && prix.pointDeVenteId === ctx.pointDeVenteId;
    case "VILLE":  return !!ctx.ville && !!prix.ville && prix.ville.toLowerCase() === ctx.ville.toLowerCase();
    case "REGION": return !!ctx.region && !!prix.region && prix.region.toLowerCase() === ctx.region.toLowerCase();
  }
}

/**
 * Résout le montant applicable d'un type de prix pour un produit dans un contexte
 * géographique donné : parmi les lignes actives et valides, on prend la plus
 * spécifique (AGENCE > VILLE > REGION > GLOBAL). Renvoie null si aucune ne matche.
 */
export async function resoudrePrix(
  produitId: number,
  type: TypePrix,
  ctx: ContexteGeo = {},
  now: Date = new Date(),
): Promise<number | null> {
  const lignes = await prisma.prixProduit.findMany({
    where: {
      produitId, type, actif: true,
      OR: [{ dateDebut: null }, { dateDebut: { lte: now } }],
      AND: [{ OR: [{ dateFin: null }, { dateFin: { gte: now } }] }],
    },
    select: { montant: true, portee: true, pointDeVenteId: true, ville: true, region: true },
  });

  const candidats = lignes
    .filter((l) => correspondGeo(l, ctx))
    .sort((a, b) => PRIORITE_PORTEE[b.portee] - PRIORITE_PORTEE[a.portee]);

  return candidats.length > 0 ? Number(candidats[0].montant) : null;
}

/**
 * Grille de prix « effective » d'un produit dans un contexte donné : pour chaque
 * type, le montant applicable (ou null). Pratique pour l'affichage catalogue.
 */
export async function grillePrixEffective(produitId: number, ctx: ContexteGeo = {}): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = {};
  const now = new Date();
  const lignes = await prisma.prixProduit.findMany({
    where: {
      produitId, actif: true,
      OR: [{ dateDebut: null }, { dateDebut: { lte: now } }],
      AND: [{ OR: [{ dateFin: null }, { dateFin: { gte: now } }] }],
    },
    select: { type: true, montant: true, portee: true, pointDeVenteId: true, ville: true, region: true },
  });
  for (const type of TYPES_PRIX) {
    const best = lignes
      .filter((l) => l.type === type && correspondGeo(l, ctx))
      .sort((a, b) => PRIORITE_PORTEE[b.portee] - PRIORITE_PORTEE[a.portee])[0];
    out[type] = best ? Number(best.montant) : null;
  }
  return out;
}

// ─── Moteur de prix automatique (Enterprise #6) ──────────────────────────────

export async function chargerParametragePrixAuto() {
  const existant = await prisma.parametragePrixAuto.findUnique({ where: { id: 1 } });
  if (existant) return existant;
  return prisma.parametragePrixAuto.create({ data: { id: 1 } });
}

/** Arrondit un montant au multiple `pas` supérieur (pas=0 → pas d'arrondi). */
export function arrondirPrix(montant: number, pas: number): number {
  if (!pas || pas <= 0) return Math.round(montant);
  return Math.ceil(montant / pas) * pas;
}

export interface CalculPrixAuto {
  prixRevient: number;   // coût d'achat + frais logistiques
  prixVente: number;     // prix de détail recalculé
  prixCredit: number | null;
}

/**
 * Calcule les prix cible à partir du coût d'achat et du paramétrage
 * (Enterprise #6) : revient = achat × (1 + fraisLogistique%), vente = revient ×
 * (1 + margeCible%), arrondis. Crédit = vente × (1 + margeCredit%) si activé.
 */
export function calculerPrixAuto(
  coutAchat: number,
  param: { margeCiblePct: Prisma.Decimal | number; fraisLogistiquePct: Prisma.Decimal | number; arrondi: number; appliquerSurCredit: boolean; margeCreditPct: Prisma.Decimal | number },
): CalculPrixAuto {
  const fraisPct = Number(param.fraisLogistiquePct);
  const margePct = Number(param.margeCiblePct);
  const prixRevient = coutAchat * (1 + fraisPct / 100);
  const prixVente = arrondirPrix(prixRevient * (1 + margePct / 100), param.arrondi);
  const prixCredit = param.appliquerSurCredit
    ? arrondirPrix(prixVente * (1 + Number(param.margeCreditPct) / 100), param.arrondi)
    : null;
  return { prixRevient: Math.round(prixRevient), prixVente, prixCredit };
}

/**
 * Upsert applicatif d'une ligne de prix GLOBAL AUTO (utilisé par le moteur).
 * Met à jour la ligne AUTO existante du type, ou la crée. N'écrase jamais une
 * ligne saisie manuellement (auto=false).
 */
export async function upsertPrixAuto(
  tx: TxClient,
  produitId: number,
  type: TypePrix,
  montant: number,
  userId?: number | null,
): Promise<void> {
  const existante = await tx.prixProduit.findFirst({
    where: { produitId, type, portee: "GLOBAL", auto: true },
    select: { id: true },
  });
  if (existante) {
    await tx.prixProduit.update({ where: { id: existante.id }, data: { montant, actif: true } });
  } else {
    await tx.prixProduit.create({
      data: { produitId, type, montant, portee: "GLOBAL", auto: true, creeParId: userId ?? null },
    });
  }
}
