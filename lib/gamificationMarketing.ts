import { Prisma, NiveauFidelite } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { attribuerPointsFidelite, NIVEAU_ORDRE } from "@/lib/fidelite";

/**
 * Gamification marketing (CDC §37) — objectif quantifiable minimal, fidèle à
 * l'exemple unique du CDC ("achetez 5 fois ce mois-ci") : NB_ACHATS ou
 * MONTANT_ACHATS sur une période, pas de moteur de règles générique. Badges =
 * attribution automatique sur condition simple (niveau de fidélité atteint, ou
 * nb d'achats total) — pas de système de règles composables.
 */

const VENTES_EXCLUES = ["ANNULEE", "BROUILLON"];

export interface ResultatChallenges {
  challengesEvalues: number;
  participationsMisesAJour: number;
  reussites: number;
}

/**
 * Pour chaque ChallengeMarketing ACTIF dans sa fenêtre : calcule la
 * progression par client (count/sum VenteDirecte depuis dateDebut, filtre
 * statut notIn [ANNULEE,BROUILLON] — même filtre que l'automatisation Phase 4),
 * upsert ParticipationChallenge, et au franchissement du seuil attribue les
 * points et marque REUSSI (une seule fois — protégé par le statut EN_COURS).
 */
export async function evaluerChallenges(): Promise<ResultatChallenges> {
  const now = new Date();
  const challenges = await prisma.challengeMarketing.findMany({
    where: { statut: "ACTIF", dateDebut: { lte: now }, dateFin: { gte: now } },
  });

  let participationsMisesAJour = 0;
  let reussites = 0;

  for (const challenge of challenges) {
    let clientsEligibles: number[] | null = null;
    if (challenge.segment) {
      const clients = await prisma.client.findMany({ where: { segment: challenge.segment }, select: { id: true } });
      clientsEligibles = clients.map((c) => c.id);
      if (!clientsEligibles.length) continue;
    }

    const whereVente: Prisma.VenteDirecteWhereInput = {
      createdAt: { gte: challenge.dateDebut },
      statut: { notIn: VENTES_EXCLUES as never },
      clientId: clientsEligibles ? { in: clientsEligibles } : { not: null },
    };

    const groupes = await prisma.venteDirecte.groupBy({
      by: ["clientId"],
      where: whereVente,
      _count: { _all: true },
      _sum: { montantTotal: true },
    });

    for (const g of groupes) {
      const clientId = g.clientId;
      if (clientId == null) continue;
      const progression = challenge.typeObjectif === "NB_ACHATS"
        ? g._count._all
        : Math.round(Number(g._sum.montantTotal ?? 0));

      const participation = await prisma.participationChallenge.upsert({
        where: { challengeId_clientId: { challengeId: challenge.id, clientId } },
        create: { challengeId: challenge.id, clientId, progression },
        update: { progression },
      });
      participationsMisesAJour += 1;

      if (participation.statut === "EN_COURS" && progression >= challenge.seuil) {
        await prisma.$transaction(async (tx) => {
          await tx.participationChallenge.update({
            where: { challengeId_clientId: { challengeId: challenge.id, clientId } },
            data: { statut: "REUSSI", dateReussite: new Date() },
          });
          await attribuerPointsFidelite(tx, {
            clientId, points: challenge.recompensePoints, type: "BONUS",
            motif: `Challenge réussi : ${challenge.nom}`, source: "CHALLENGE",
          });
        });
        reussites += 1;
      }
    }
  }

  return { challengesEvalues: challenges.length, participationsMisesAJour, reussites };
}

type ConditionBadge =
  | { type: "NIVEAU_FIDELITE"; niveau: NiveauFidelite }
  | { type: "NB_ACHATS"; seuil: number };

export interface ResultatBadges {
  badgesEvalues: number;
  attributions: number;
}

/** Scanne les conditions simples des badges actifs et crée BadgeClient si absent. */
export async function evaluerBadges(): Promise<ResultatBadges> {
  const badges = await prisma.badgeMarketing.findMany({ where: { actif: true } });
  let attributions = 0;

  for (const badge of badges) {
    const condition = badge.condition as unknown as ConditionBadge | null;
    let clientsEligibles: number[] = [];

    if (condition?.type === "NIVEAU_FIDELITE") {
      const niveauIdx = NIVEAU_ORDRE.indexOf(condition.niveau);
      if (niveauIdx < 0) continue;
      const niveauxEligibles = NIVEAU_ORDRE.slice(niveauIdx);
      const comptes = await prisma.compteFidelite.findMany({
        where: { niveau: { in: niveauxEligibles } }, select: { clientId: true },
      });
      clientsEligibles = comptes.map((c) => c.clientId);
    } else if (condition?.type === "NB_ACHATS") {
      const seuil = Number(condition.seuil ?? 0);
      if (seuil <= 0) continue;
      const groupes = await prisma.venteDirecte.groupBy({
        by: ["clientId"],
        where: { clientId: { not: null }, statut: { notIn: VENTES_EXCLUES as never } },
        _count: { _all: true },
      });
      clientsEligibles = groupes.filter((g) => g._count._all >= seuil).map((g) => g.clientId as number);
    } else {
      continue;
    }

    if (!clientsEligibles.length) continue;

    const dejaAttribues = await prisma.badgeClient.findMany({
      where: { badgeId: badge.id, clientId: { in: clientsEligibles } },
      select: { clientId: true },
    });
    const dejaSet = new Set(dejaAttribues.map((d) => d.clientId));
    const nouveaux = clientsEligibles.filter((id) => !dejaSet.has(id));
    if (!nouveaux.length) continue;

    const { count } = await prisma.badgeClient.createMany({
      data: nouveaux.map((clientId) => ({ badgeId: badge.id, clientId })),
      skipDuplicates: true,
    });
    attributions += count;
  }

  return { badgesEvalues: badges.length, attributions };
}
