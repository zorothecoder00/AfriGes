import { prisma } from "@/lib/prisma";
import { calculerSegmentsRFM, type SegmentRFM } from "@/lib/audienceMarketing";

/**
 * Analytics marketing (CDC §7 — Phase 7) : attribution, valeur vie client
 * (CLV), rétention/churn, recommandations. Aucune infra ML dans ce codebase —
 * projections et recommandations reposent sur des heuristiques documentées,
 * pas des modèles probabilistes (cohérent avec le reste du module).
 */

const JOUR_MS = 24 * 60 * 60 * 1000;
const VENTES_EXCLUES = ["ANNULEE", "BROUILLON"];

// ─── Attribution multi-dimension (CDC §83-84 marketing_attribution) ────────

export interface RepartitionAttribution {
  parTypeCampagne: { label: string; ca: number }[];
  parSegmentClient: { label: string; ca: number }[];
  parFamilleProduit: { label: string; ca: number }[];
}

/**
 * Répartit le CA attribué (ventes liées à une campagne) selon plusieurs axes.
 * Attribution "dernier contact" (le champ VenteDirecte.campagneId déjà posé
 * en Phase 1) — pas de modèle multi-touch, cohérent avec l'existant.
 */
export async function rapportAttribution(debut: Date, fin: Date): Promise<RepartitionAttribution> {
  const ventes = await prisma.venteDirecte.findMany({
    where: { campagneId: { not: null }, createdAt: { gte: debut, lte: fin }, statut: { notIn: VENTES_EXCLUES as never } },
    select: {
      montantTotal: true,
      campagne: { select: { typeCampagne: { select: { libelle: true } } } },
      client: { select: { segment: true } },
      lignes: { select: { montant: true, produit: { select: { famille: { select: { nom: true } } } } } },
    },
  });

  const parType = new Map<string, number>();
  const parSegment = new Map<string, number>();
  const parFamille = new Map<string, number>();

  for (const v of ventes) {
    const typeLabel = v.campagne?.typeCampagne.libelle ?? "—";
    parType.set(typeLabel, (parType.get(typeLabel) ?? 0) + Number(v.montantTotal));

    const segLabel = v.client?.segment === "RIA" ? "Communauté RIA" : "Ordinaire";
    parSegment.set(segLabel, (parSegment.get(segLabel) ?? 0) + Number(v.montantTotal));

    for (const l of v.lignes) {
      const familleLabel = l.produit?.famille?.nom ?? "—";
      parFamille.set(familleLabel, (parFamille.get(familleLabel) ?? 0) + Number(l.montant));
    }
  }

  const toArray = (m: Map<string, number>) => [...m.entries()].map(([label, ca]) => ({ label, ca })).sort((a, b) => b.ca - a.ca);
  return { parTypeCampagne: toArray(parType), parSegmentClient: toArray(parSegment), parFamilleProduit: toArray(parFamille) };
}

// ─── CLV — Customer Lifetime Value (CDC §7) ────────────────────────────────

export interface ClientCLV {
  clientId: number;
  caTotal: number;
  nbAchats: number;
  panierMoyen: number;
  clvEstime: number;
  client: { id: number; nom: string; prenom: string; segment: string } | null;
}

/**
 * Top clients par valeur vie estimée. Projection heuristique glissante sur 12
 * mois (panier moyen × fréquence mensuelle × 12) — pas un modèle probabiliste,
 * juste une extrapolation du rythme d'achat observé.
 */
export async function topClientsCLV(limit = 20): Promise<ClientCLV[]> {
  const groupes = await prisma.venteDirecte.groupBy({
    by: ["clientId"],
    where: { clientId: { not: null }, statut: { notIn: VENTES_EXCLUES as never } },
    _sum: { montantTotal: true }, _count: { _all: true }, _min: { createdAt: true },
  });

  const now = Date.now();
  const items = groupes
    .filter((g): g is typeof g & { clientId: number } => g.clientId != null)
    .map((g) => {
      const caTotal = Number(g._sum.montantTotal ?? 0);
      const nbAchats = g._count._all;
      const premier = g._min.createdAt as Date;
      const ancienneteJours = Math.max(1, Math.floor((now - premier.getTime()) / JOUR_MS));
      const panierMoyen = nbAchats > 0 ? caTotal / nbAchats : 0;
      const frequenceMensuelle = nbAchats / Math.max(1, ancienneteJours / 30);
      const clvEstime = panierMoyen * frequenceMensuelle * 12;
      return { clientId: g.clientId, caTotal, nbAchats, panierMoyen, clvEstime };
    })
    .sort((a, b) => b.clvEstime - a.clvEstime)
    .slice(0, limit);

  const clients = await prisma.client.findMany({
    where: { id: { in: items.map((i) => i.clientId) } },
    select: { id: true, nom: true, prenom: true, segment: true },
  });
  const clientMap = new Map(clients.map((c) => [c.id, c]));

  return items.map((i) => ({ ...i, client: clientMap.get(i.clientId) ?? null }));
}

// ─── Rétention / Churn (CDC §7) ─────────────────────────────────────────────

export interface TauxRetention {
  actifsPeriodePrecedente: number;
  retenus: number;
  tauxRetention: number | null;
  tauxChurn: number | null;
}

/**
 * Taux de rétention sur une période : parmi les clients actifs (≥1 achat) sur
 * la période précédente de même durée, quelle proportion a de nouveau acheté
 * sur la période demandée.
 */
export async function tauxRetention(debut: Date, fin: Date): Promise<TauxRetention> {
  const dureeMs = fin.getTime() - debut.getTime();
  const debutPrec = new Date(debut.getTime() - dureeMs);

  const actifsPrec = await prisma.venteDirecte.findMany({
    where: { createdAt: { gte: debutPrec, lt: debut }, statut: { notIn: VENTES_EXCLUES as never }, clientId: { not: null } },
    select: { clientId: true }, distinct: ["clientId"],
  });
  const idsPrec = actifsPrec.map((c) => c.clientId as number);
  if (!idsPrec.length) return { actifsPeriodePrecedente: 0, retenus: 0, tauxRetention: null, tauxChurn: null };

  const actifsActuels = await prisma.venteDirecte.findMany({
    where: { createdAt: { gte: debut, lte: fin }, statut: { notIn: VENTES_EXCLUES as never }, clientId: { in: idsPrec } },
    select: { clientId: true }, distinct: ["clientId"],
  });

  const retenus = actifsActuels.length;
  return {
    actifsPeriodePrecedente: idsPrec.length, retenus,
    tauxRetention: (retenus / idsPrec.length) * 100,
    tauxChurn: ((idsPrec.length - retenus) / idsPrec.length) * 100,
  };
}

// ─── Recommandations (CDC §7 — pas d'IA générative, heuristiques par segment RFM) ─

export interface RecommandationMarketing {
  segment: SegmentRFM;
  nbClients: number;
  action: string;
  priorite: "HAUTE" | "NORMALE";
}

const ACTIONS_PAR_SEGMENT: Record<SegmentRFM, { action: string; priorite: "HAUTE" | "NORMALE" } | null> = {
  A_RISQUE: { action: "Lancer une campagne de réactivation ciblée (coupon ou message personnalisé) avant qu'ils ne deviennent dormants.", priorite: "HAUTE" },
  DORMANTS: { action: "Campagne de relance avec offre incitative (coupon de réduction ou points de fidélité bonus).", priorite: "NORMALE" },
  CHAMPIONS: { action: "Proposer un programme VIP ou des récompenses exclusives pour renforcer la fidélité.", priorite: "NORMALE" },
  NOUVEAUX: { action: "Vérifier qu'une séquence de bienvenue (automatisation, déclencheur NOUVEAU_CLIENT) est active.", priorite: "NORMALE" },
  GROS_ACHETEURS: { action: "Cibler pour des offres de cross-selling sur des produits complémentaires à forte marge.", priorite: "NORMALE" },
  PERDUS: { action: "Campagne de reconquête à faible coût, ou exclusion des envois réguliers pour réduire le coût marketing.", priorite: "NORMALE" },
  FIDELES: null, // pas d'action urgente — segment déjà stable
};

/** Recommandations d'actions marketing par segment RFM (réutilise Phase 1, pas de duplication). */
export async function recommandationsMarketing(): Promise<{ compteurs: Record<SegmentRFM, number>; recommandations: RecommandationMarketing[] }> {
  const rfm = await calculerSegmentsRFM();
  const compteurs: Record<SegmentRFM, number> = { CHAMPIONS: 0, FIDELES: 0, GROS_ACHETEURS: 0, NOUVEAUX: 0, A_RISQUE: 0, DORMANTS: 0, PERDUS: 0 };
  for (const c of rfm) compteurs[c.segment] += 1;

  const recommandations: RecommandationMarketing[] = [];
  for (const [segment, nbClients] of Object.entries(compteurs) as [SegmentRFM, number][]) {
    const def = ACTIONS_PAR_SEGMENT[segment];
    if (def && nbClients > 0) recommandations.push({ segment, nbClients, action: def.action, priorite: def.priorite });
  }
  recommandations.sort((a, b) => (a.priorite === b.priorite ? b.nbClients - a.nbClients : a.priorite === "HAUTE" ? -1 : 1));

  return { compteurs, recommandations };
}
