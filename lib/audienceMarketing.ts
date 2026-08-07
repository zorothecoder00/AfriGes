import { Prisma, ChampAudience, OperateurAudience, TypeAudience } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { distanceKm } from "@/lib/geo";

export interface RegleAudience {
  champ: ChampAudience;
  operateur: OperateurAudience;
  valeur: string;
}

const N = (v: string) => Number(v);
const jourMs = 24 * 60 * 60 * 1000;

/**
 * Champs directement filtrables sur `Client` (pas d'agrégation nécessaire).
 * Les autres champs (achats, produits, fidélité, tags) nécessitent une
 * sous-requête dédiée — traités séparément dans `calculerAudience`.
 */
const CHAMPS_DIRECTS: ChampAudience[] = [
  "SEGMENT", "TYPE_CLIENT", "VILLE", "COMMUNE", "QUARTIER", "SEXE", "POINT_DE_VENTE", "STATUT_CREDIT", "ACTIVITE", "AGE",
];

/** Date de naissance correspondant à un âge de `annees` révolues, à la date du jour. */
function dateAgeCutoff(annees: number): Date {
  const now = new Date();
  return new Date(now.getFullYear() - annees, now.getMonth(), now.getDate());
}

/** Traduit une règle AGE (années) en filtre Prisma sur `Client.dateNaissance`. */
function appliquerOperateurAge(regle: RegleAudience): Prisma.ClientWhereInput["dateNaissance"] {
  const seuil = N(regle.valeur);
  const cutoff = dateAgeCutoff(seuil); // né ce jour-là = exactement `seuil` ans aujourd'hui
  switch (regle.operateur) {
    case "SUPERIEUR":       return { lt: cutoff }; // plus vieux que seuil ans
    case "SUPERIEUR_EGAL":  return { lte: cutoff };
    case "INFERIEUR":       return { gt: cutoff }; // plus jeune que seuil ans
    case "INFERIEUR_EGAL":  return { gte: cutoff };
    case "DIFFERENT":       return { not: { gt: dateAgeCutoff(seuil + 1), lte: cutoff } as never };
    default:                return { gt: dateAgeCutoff(seuil + 1), lte: cutoff }; // EGAL — né dans l'année d'anniversaire
  }
}

function appliquerOperateurTexte(regle: RegleAudience): Prisma.ClientWhereInput[keyof Prisma.ClientWhereInput] {
  switch (regle.operateur) {
    case "EGAL":      return { equals: regle.valeur };
    case "DIFFERENT": return { not: regle.valeur };
    case "CONTIENT":  return { contains: regle.valeur, mode: "insensitive" };
    default:          return { equals: regle.valeur };
  }
}

/** Traduit les règles à champ direct (SEGMENT, VILLE, ...) en filtre Prisma sur Client. */
function construireWhereDirect(regles: RegleAudience[]): Prisma.ClientWhereInput {
  const where: Prisma.ClientWhereInput = {};
  for (const r of regles.filter((r) => CHAMPS_DIRECTS.includes(r.champ))) {
    switch (r.champ) {
      case "SEGMENT":         where.segment = appliquerOperateurTexte(r) as never; break;
      case "TYPE_CLIENT":     where.typeClient = appliquerOperateurTexte(r) as never; break;
      case "VILLE":           where.ville = appliquerOperateurTexte(r) as never; break;
      case "COMMUNE":         where.commune = appliquerOperateurTexte(r) as never; break;
      case "QUARTIER":        where.quartier = appliquerOperateurTexte(r) as never; break;
      case "SEXE":            where.sexe = appliquerOperateurTexte(r) as never; break;
      case "POINT_DE_VENTE":  where.pointDeVenteId = N(r.valeur); break;
      case "STATUT_CREDIT":
        where.creditsClients = { some: { statut: r.valeur as never } };
        break;
      case "ACTIVITE":        where.activite = appliquerOperateurTexte(r) as never; break;
      case "AGE":             where.dateNaissance = appliquerOperateurAge(r); break;
    }
  }
  return where;
}

/**
 * Client ids satisfaisant une règle nécessitant une agrégation sur les ventes,
 * la fidélité ou les tags (pas exprimable en un seul `where` Client).
 * Retourne `null` si le champ n'a pas besoin d'agrégation (déjà géré ailleurs).
 */
async function idsPourRegleAgregee(regle: RegleAudience, candidats: number[]): Promise<number[] | null> {
  if (candidats.length === 0) return [];
  const now = new Date();

  switch (regle.champ) {
    case "MONTANT_ACHAT_TOTAL": {
      const groupes = await prisma.venteDirecte.groupBy({
        by: ["clientId"],
        where: { clientId: { in: candidats } },
        _sum: { montantTotal: true },
      });
      const seuil = N(regle.valeur);
      return groupes
        .filter((g) => cmp(Number(g._sum.montantTotal ?? 0), regle.operateur, seuil))
        .map((g) => g.clientId as number);
    }
    case "FREQUENCE_ACHAT": {
      const groupes = await prisma.venteDirecte.groupBy({
        by: ["clientId"],
        where: { clientId: { in: candidats } },
        _count: { _all: true },
      });
      const seuil = N(regle.valeur);
      return groupes
        .filter((g) => cmp(g._count._all, regle.operateur, seuil))
        .map((g) => g.clientId as number);
    }
    case "DERNIER_ACHAT_JOURS": {
      const groupes = await prisma.venteDirecte.groupBy({
        by: ["clientId"],
        where: { clientId: { in: candidats } },
        _max: { createdAt: true },
      });
      const seuilJours = N(regle.valeur);
      const parClient = new Map(groupes.map((g) => [g.clientId as number, g._max.createdAt]));
      return candidats.filter((id) => {
        const dernier = parClient.get(id);
        // Pas d'achat connu = "dernier achat" infiniment ancien → compte comme
        // très en retard (utile pour cibler les prospects jamais convertis).
        const joursEcoules = dernier ? Math.floor((now.getTime() - dernier.getTime()) / jourMs) : Infinity;
        if (regle.operateur === "DEPUIS_JOURS") return joursEcoules <= seuilJours; // achat récent (< N jours)
        return cmp(joursEcoules, regle.operateur, seuilJours);
      });
    }
    case "PRODUIT_ACHETE": {
      const ventes = await prisma.ligneVenteDirecte.findMany({
        where: { produitId: N(regle.valeur), vente: { clientId: { in: candidats } } },
        select: { vente: { select: { clientId: true } } },
      });
      return [...new Set(ventes.map((v) => v.vente.clientId).filter((id): id is number => id != null))];
    }
    case "FAMILLE_PRODUIT_ACHETEE": {
      const ventes = await prisma.ligneVenteDirecte.findMany({
        where: { produit: { familleId: N(regle.valeur) }, vente: { clientId: { in: candidats } } },
        select: { vente: { select: { clientId: true } } },
      });
      return [...new Set(ventes.map((v) => v.vente.clientId).filter((id): id is number => id != null))];
    }
    case "NIVEAU_FIDELITE": {
      const comptes = await prisma.compteFidelite.findMany({
        where: { clientId: { in: candidats }, niveau: regle.valeur as never },
        select: { clientId: true },
      });
      return comptes.map((c) => c.clientId);
    }
    case "TAG": {
      const tags = await prisma.clientTag.findMany({
        where: { clientId: { in: candidats }, tagId: N(regle.valeur) },
        select: { clientId: true },
      });
      return tags.map((t) => t.clientId);
    }
    case "DISTANCE_AGENCE_KM": {
      // Format valeur : "pointDeVenteId:rayonKm" (CDC §51 — pas de champ dédié,
      // opérateur ignoré : toujours "dans le rayon").
      const [pdvIdStr, rayonStr] = regle.valeur.split(":");
      const pdvId = N(pdvIdStr);
      const rayonKm = N(rayonStr);
      if (!pdvId || !rayonKm) return [];
      const pdv = await prisma.pointDeVente.findUnique({ where: { id: pdvId }, select: { latitude: true, longitude: true } });
      if (pdv?.latitude == null || pdv?.longitude == null) return [];
      const clients = await prisma.client.findMany({
        where: { id: { in: candidats }, latitude: { not: null }, longitude: { not: null } },
        select: { id: true, latitude: true, longitude: true },
      });
      return clients
        .filter((c) => distanceKm(pdv.latitude!, pdv.longitude!, c.latitude!, c.longitude!) <= rayonKm)
        .map((c) => c.id);
    }
    case "CANAL": {
      // CDC §11 — clients déjà touchés via ce canal (code CanalMarketing, ex "SMS").
      // Opérateur ignoré, comme DISTANCE_AGENCE_KM : "a déjà été contacté sur ce canal".
      const envois = await prisma.envoiMessage.findMany({
        where: { clientId: { in: candidats }, canal: { code: regle.valeur } },
        select: { clientId: true },
      });
      return [...new Set(envois.map((e) => e.clientId))];
    }
    default:
      return null; // champ direct, déjà géré par construireWhereDirect
  }
}

function cmp(valeur: number, operateur: OperateurAudience, seuil: number): boolean {
  switch (operateur) {
    case "EGAL":            return valeur === seuil;
    case "DIFFERENT":       return valeur !== seuil;
    case "SUPERIEUR":       return valeur > seuil;
    case "INFERIEUR":       return valeur < seuil;
    case "SUPERIEUR_EGAL":  return valeur >= seuil;
    case "INFERIEUR_EGAL":  return valeur <= seuil;
    default:                return valeur === seuil;
  }
}

/**
 * Évalue un ensemble de règles combinées en ET (CDC §11 — filtres combinables ;
 * pas d'arbre OU/ET complexe en V1) et retourne les ids clients qualifiés.
 */
export async function calculerAudience(regles: RegleAudience[]): Promise<number[]> {
  const whereDirect = construireWhereDirect(regles);
  const candidats = await prisma.client.findMany({ where: whereDirect, select: { id: true } });
  let ids = candidats.map((c) => c.id);

  const reglesAgregees = regles.filter((r) => !CHAMPS_DIRECTS.includes(r.champ));
  for (const regle of reglesAgregees) {
    if (ids.length === 0) break;
    const qualifies = await idsPourRegleAgregee(regle, ids);
    if (qualifies !== null) ids = qualifies;
  }
  return ids;
}

/**
 * Recalcule une audience : no-op pour les audiences STATIQUE (figées à la
 * création, CDC §13), recalcul complet pour les DYNAMIQUE (CDC §12).
 */
export async function recalculerAudience(audienceId: number): Promise<{ taille: number }> {
  const audience = await prisma.audienceMarketing.findUnique({
    where: { id: audienceId },
    include: { regles: true },
  });
  if (!audience) throw new Error("Audience introuvable");

  if (audience.type === ("STATIQUE" satisfies TypeAudience)) {
    return { taille: audience.tailleCalculee ?? 0 };
  }

  const ids = await calculerAudience(audience.regles);
  await prisma.$transaction([
    prisma.audienceMarketingMembre.deleteMany({ where: { audienceId } }),
    prisma.audienceMarketingMembre.createMany({
      data: ids.map((clientId) => ({ audienceId, clientId })),
      skipDuplicates: true,
    }),
    prisma.audienceMarketing.update({
      where: { id: audienceId },
      data: { tailleCalculee: ids.length, dateDernierCalcul: new Date() },
    }),
  ]);
  return { taille: ids.length };
}

/** Fige les membres d'une audience STATIQUE à partir de ses règles (appelé une seule fois, à la création). */
export async function figerAudienceStatique(audienceId: number, regles: RegleAudience[]): Promise<{ taille: number }> {
  const ids = await calculerAudience(regles);
  await prisma.$transaction([
    prisma.audienceMarketingMembre.createMany({
      data: ids.map((clientId) => ({ audienceId, clientId })),
      skipDuplicates: true,
    }),
    prisma.audienceMarketing.update({
      where: { id: audienceId },
      data: { tailleCalculee: ids.length, dateDernierCalcul: new Date() },
    }),
  ]);
  return { taille: ids.length };
}

// ── Segmentation RFM (CDC §14) ───────────────────────────────────────────────

export type SegmentRFM =
  | "CHAMPIONS" | "FIDELES" | "GROS_ACHETEURS" | "NOUVEAUX"
  | "A_RISQUE" | "DORMANTS" | "PERDUS";

export interface ClientRFM {
  clientId: number;
  recenceJours: number;
  frequence: number;
  montantTotal: number;
  segment: SegmentRFM;
}

/** Charge (et crée au besoin) le paramétrage singleton des seuils RFM (CDC §81 — sans code). */
export async function chargerParametrageRFM() {
  const existant = await prisma.parametrageRFM.findUnique({ where: { id: 1 } });
  if (existant) return existant;
  return prisma.parametrageRFM.create({ data: { id: 1 } });
}

/**
 * Calcule Récence/Fréquence/Montant par client à partir de VenteDirecte et les
 * étiquette en 7 segments (CDC §14). Seuils simples et documentés (pas de
 * scoring quintile ML) — cohérent avec le niveau Phase 1 du module. Seuils
 * chargés depuis ParametrageRFM (éditables sans code), défauts = valeurs
 * historiques en dur (zéro régression tant que personne n'édite).
 */
export async function calculerSegmentsRFM(): Promise<ClientRFM[]> {
  const param = await chargerParametrageRFM();
  const now = new Date();
  const groupes = await prisma.venteDirecte.groupBy({
    by: ["clientId"],
    where: { clientId: { not: null } },
    _sum: { montantTotal: true },
    _count: { _all: true },
    _max: { createdAt: true },
  });

  const montants = groupes.map((g) => Number(g._sum.montantTotal ?? 0)).sort((a, b) => b - a);
  const seuilGrosAcheteur = montants[Math.floor(montants.length * param.percentileGrosAcheteur)] ?? Infinity;

  return groupes
    .filter((g) => g.clientId != null)
    .map((g) => {
      const montantTotal = Number(g._sum.montantTotal ?? 0);
      const frequence = g._count._all;
      const dernier = g._max.createdAt as Date;
      const recenceJours = Math.floor((now.getTime() - dernier.getTime()) / jourMs);

      let segment: SegmentRFM;
      if (frequence === 1 && recenceJours <= param.seuilChampionRecenceJours) segment = "NOUVEAUX";
      else if (recenceJours > param.seuilPerduJours) segment = "PERDUS";
      else if (recenceJours > param.seuilDormantJours) segment = "DORMANTS";
      else if (recenceJours > param.seuilRisqueJours && frequence >= param.seuilRisqueFrequenceMin) segment = "A_RISQUE"; // achetait régulièrement, ralentit (§15)
      else if (montantTotal >= seuilGrosAcheteur) segment = "GROS_ACHETEURS";
      else if (frequence >= param.seuilChampionFrequence && recenceJours <= param.seuilChampionRecenceJours) segment = "CHAMPIONS";
      else if (frequence >= param.seuilFideleFrequence) segment = "FIDELES";
      else segment = "FIDELES";

      return { clientId: g.clientId as number, recenceJours, frequence, montantTotal, segment };
    });
}
