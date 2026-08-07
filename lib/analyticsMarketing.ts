import { prisma } from "@/lib/prisma";
import { calculerSegmentsRFM, type SegmentRFM } from "@/lib/audienceMarketing";
import { calculerAttributionVente, type ModeleAttribution } from "@/lib/attributionModeles";

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
 * `modele` (CDC §57) : CAMPAIGN_BASED (défaut, comportement historique — 100%
 * à VenteDirecte.campagneId) ou FIRST_TOUCH/LAST_TOUCH/LINEAR (reconstruction
 * multi-touch via lib/attributionModeles.ts, plus coûteux car évalué vente par
 * vente).
 */
export async function rapportAttribution(debut: Date, fin: Date, modele: ModeleAttribution = "CAMPAIGN_BASED"): Promise<RepartitionAttribution> {
  const ventes = await prisma.venteDirecte.findMany({
    where: { campagneId: { not: null }, createdAt: { gte: debut, lte: fin }, statut: { notIn: VENTES_EXCLUES as never } },
    select: {
      campagneId: true, clientId: true, createdAt: true, montantTotal: true,
      client: { select: { segment: true } },
      lignes: { select: { montant: true, produit: { select: { famille: { select: { nom: true } } } } } },
    },
  });

  const parType = new Map<string, number>();
  const parSegment = new Map<string, number>();
  const parFamille = new Map<string, number>();

  // Cache des libellés de type de campagne (une seule requête, réutilisée pour
  // toutes les ventes/toutes les campagnes touchées par le modèle multi-touch).
  const campagneIds = [...new Set(ventes.map((v) => v.campagneId).filter((id): id is number => id != null))];
  const campagnes = campagneIds.length
    ? await prisma.campagne.findMany({ where: { id: { in: campagneIds } }, select: { id: true, typeCampagne: { select: { libelle: true } } } })
    : [];
  const typeLabelParCampagne = new Map(campagnes.map((c) => [c.id, c.typeCampagne.libelle]));

  for (const v of ventes) {
    const segLabel = v.client?.segment === "RIA" ? "Communauté RIA" : "Ordinaire";
    parSegment.set(segLabel, (parSegment.get(segLabel) ?? 0) + Number(v.montantTotal));

    for (const l of v.lignes) {
      const familleLabel = l.produit?.famille?.nom ?? "—";
      parFamille.set(familleLabel, (parFamille.get(familleLabel) ?? 0) + Number(l.montant));
    }

    const attribution = await calculerAttributionVente(v, modele);
    for (const a of attribution) {
      const typeLabel = typeLabelParCampagne.get(a.campagneId) ?? "—";
      parType.set(typeLabel, (parType.get(typeLabel) ?? 0) + Number(v.montantTotal) * a.poids);
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

// ─── Analyse par canal (CDC §59) ────────────────────────────────────────────

export interface LigneCanal {
  canal: string;
  leads: number;
  clients: number;
  ca: number;
  cout: number;
  cac: number | null;
  roi: number | null;
}

/**
 * Comparatif Canal/Leads/Clients/CA/Coût/CAC/ROI (CDC §59). Une campagne
 * multi-canaux répartit son CA/coût à parts égales entre ses canaux (même
 * simplification que `parAgence` dans /api/admin/marketing/stats). Inclut
 * deux pseudo-canaux "Terrain" et "Événementiel" (CDC §59 cite "Terrain" en
 * exemple, à côté de Facebook/WhatsApp/Radio) car ce ne sont pas des
 * CanalMarketing au sens Communication (Phase 2), mais des canaux d'acquisition
 * à part entière (Phase 6).
 */
export async function rapportParCanal(debut: Date, fin: Date): Promise<LigneCanal[]> {
  const canaux = await prisma.canalMarketing.findMany({ where: { actif: true }, select: { id: true, libelle: true } });

  const campagnesCanaux = await prisma.campagneCanal.findMany({ select: { campagneId: true, canalId: true } });
  const canalIdsParCampagne = new Map<number, number[]>();
  for (const cc of campagnesCanaux) {
    const arr = canalIdsParCampagne.get(cc.campagneId) ?? [];
    arr.push(cc.canalId);
    canalIdsParCampagne.set(cc.campagneId, arr);
  }

  const [ventes, depenses, leadsDistinct] = await Promise.all([
    prisma.venteDirecte.findMany({
      where: { campagneId: { not: null }, createdAt: { gte: debut, lte: fin }, statut: { notIn: VENTES_EXCLUES as never } },
      select: { campagneId: true, clientId: true, montantTotal: true },
    }),
    prisma.depenseMarketing.findMany({ where: { date: { gte: debut, lte: fin } }, select: { campagneId: true, montant: true } }),
    prisma.envoiMessage.findMany({
      where: { dateEnvoi: { gte: debut, lte: fin }, statut: { not: "EN_ATTENTE" } },
      select: { canalId: true, clientId: true }, distinct: ["canalId", "clientId"],
    }),
  ]);

  const caParCanal = new Map<number, number>();
  const coutParCanal = new Map<number, number>();
  const clientsParCanal = new Map<number, Set<number>>();
  const leadsParCanal = new Map<number, number>();

  for (const v of ventes) {
    const canalIds = canalIdsParCampagne.get(v.campagneId as number) ?? [];
    if (!canalIds.length) continue;
    const part = Number(v.montantTotal) / canalIds.length;
    for (const cid of canalIds) {
      caParCanal.set(cid, (caParCanal.get(cid) ?? 0) + part);
      if (v.clientId) {
        const s = clientsParCanal.get(cid) ?? new Set<number>();
        s.add(v.clientId);
        clientsParCanal.set(cid, s);
      }
    }
  }
  for (const d of depenses) {
    const canalIds = canalIdsParCampagne.get(d.campagneId) ?? [];
    if (!canalIds.length) continue;
    const part = Number(d.montant) / canalIds.length;
    for (const cid of canalIds) coutParCanal.set(cid, (coutParCanal.get(cid) ?? 0) + part);
  }
  for (const l of leadsDistinct) leadsParCanal.set(l.canalId, (leadsParCanal.get(l.canalId) ?? 0) + 1);

  const lignes: LigneCanal[] = canaux.map((c) => {
    const ca = caParCanal.get(c.id) ?? 0;
    const cout = coutParCanal.get(c.id) ?? 0;
    const clients = clientsParCanal.get(c.id)?.size ?? 0;
    return {
      canal: c.libelle, leads: leadsParCanal.get(c.id) ?? 0, clients, ca, cout,
      cac: clients > 0 ? cout / clients : null,
      roi: cout > 0 ? ((ca - cout) / cout) * 100 : null,
    };
  });

  const [operations, evenements, participants] = await Promise.all([
    prisma.operationTerrain.findMany({
      where: { dateDebut: { lte: fin }, dateFin: { gte: debut } },
      select: { budget: true, prospectsGeneres: true, clientsConvertis: true, ventesGenereesCA: true },
    }),
    prisma.evenementMarketing.findMany({ where: { dateDebut: { lte: fin }, dateFin: { gte: debut } }, select: { budget: true } }),
    prisma.participantEvenement.findMany({ where: { createdAt: { gte: debut, lte: fin } }, select: { clientId: true } }),
  ]);

  const terrainCout = operations.reduce((s, o) => s + Number(o.budget), 0);
  const terrainCa = operations.reduce((s, o) => s + Number(o.ventesGenereesCA), 0);
  const terrainClients = operations.reduce((s, o) => s + o.clientsConvertis, 0);
  lignes.push({
    canal: "Terrain", leads: operations.reduce((s, o) => s + o.prospectsGeneres, 0), clients: terrainClients,
    ca: terrainCa, cout: terrainCout,
    cac: terrainClients > 0 ? terrainCout / terrainClients : null,
    roi: terrainCout > 0 ? ((terrainCa - terrainCout) / terrainCout) * 100 : null,
  });

  const evtCout = evenements.reduce((s, e) => s + Number(e.budget), 0);
  const evtClients = participants.filter((p) => p.clientId != null).length;
  lignes.push({
    canal: "Événementiel", leads: participants.length, clients: evtClients,
    ca: 0, cout: evtCout, // CA non tracké par événement (pas de lien direct vente↔événement)
    cac: evtClients > 0 ? evtCout / evtClients : null, roi: null,
  });

  return lignes.sort((a, b) => b.ca - a.ca);
}

// ─── Analyse produits marketing (CDC §60-61) ────────────────────────────────

export interface LigneProduitMarketing {
  produitId: number;
  nom: string;
  ventesApresCampagne: number;
  caApresCampagne: number;
  nbPromotionsCoupons: number;
  margeUnitaire: number | null;
  rotation: number | null; // quantité vendue (période) / stock actuel — faible = rotation lente
  stockDisponible: number;
}

/**
 * Produits les plus promus / les plus vendus après campagne / rotation / marge
 * (CDC §60) + disponibilité stock consultable côté marketing (CDC §61 — lecture
 * seule, ne gère pas le stock). "Produits complémentaires" et "saisonniers" ne
 * sont PAS couverts : aucune donnée de catalogue croisée (liens produits
 * complémentaires, tag saisonnier) n'existe dans ce codebase — limite honnête,
 * pas un oubli d'implémentation.
 */
export async function rapportProduitsMarketing(debut: Date, fin: Date, limit = 20): Promise<LigneProduitMarketing[]> {
  const lignesCampagne = await prisma.ligneVenteDirecte.groupBy({
    by: ["produitId"],
    where: { produitId: { not: null }, vente: { campagneId: { not: null }, createdAt: { gte: debut, lte: fin }, statut: { notIn: VENTES_EXCLUES as never } } },
    _sum: { quantite: true, montant: true },
  });
  if (!lignesCampagne.length) return [];

  const produitIds = lignesCampagne.filter((l) => l.produitId != null).map((l) => l.produitId as number);

  const [produits, stocks, ventesGlobales, promoParProduit, couponParProduit] = await Promise.all([
    prisma.produit.findMany({ where: { id: { in: produitIds } }, select: { id: true, nom: true, prixUnitaire: true, prixAchat: true } }),
    prisma.stockSite.groupBy({ by: ["produitId"], where: { produitId: { in: produitIds } }, _sum: { quantite: true } }),
    prisma.ligneVenteDirecte.groupBy({
      by: ["produitId"],
      where: { produitId: { in: produitIds }, vente: { createdAt: { gte: debut, lte: fin }, statut: { notIn: VENTES_EXCLUES as never } } },
      _sum: { quantite: true },
    }),
    prisma.promotion.groupBy({ by: ["produitId"], where: { produitId: { in: produitIds }, actif: true, dateDebut: { lte: fin }, dateFin: { gte: debut } }, _count: { _all: true } }),
    prisma.coupon.groupBy({ by: ["produitId"], where: { produitId: { in: produitIds }, actif: true, dateDebut: { lte: fin }, dateFin: { gte: debut } }, _count: { _all: true } }),
  ]);

  const produitMap = new Map(produits.map((p) => [p.id, p]));
  const stockMap = new Map(stocks.map((s) => [s.produitId, Number(s._sum.quantite ?? 0)]));
  const venteGlobaleMap = new Map(ventesGlobales.map((v) => [v.produitId, Number(v._sum.quantite ?? 0)]));
  const promoMap = new Map(promoParProduit.map((p) => [p.produitId, p._count._all]));
  const couponMap = new Map(couponParProduit.filter((c) => c.produitId != null).map((c) => [c.produitId as number, c._count._all]));

  return lignesCampagne
    .filter((l): l is typeof l & { produitId: number } => l.produitId != null)
    .map((l) => {
      const produit = produitMap.get(l.produitId);
      const stock = stockMap.get(l.produitId) ?? 0;
      const venteGlobale = venteGlobaleMap.get(l.produitId) ?? 0;
      return {
        produitId: l.produitId,
        nom: produit?.nom ?? `Produit #${l.produitId}`,
        ventesApresCampagne: l._sum.quantite ?? 0,
        caApresCampagne: Number(l._sum.montant ?? 0),
        nbPromotionsCoupons: (promoMap.get(l.produitId) ?? 0) + (couponMap.get(l.produitId) ?? 0),
        margeUnitaire: produit ? Number(produit.prixUnitaire) - Number(produit.prixAchat ?? 0) : null,
        rotation: stock > 0 ? Math.round((venteGlobale / stock) * 100) / 100 : null,
        stockDisponible: stock,
      };
    })
    .sort((a, b) => b.caApresCampagne - a.caApresCampagne)
    .slice(0, limit);
}
