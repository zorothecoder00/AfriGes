// lib/popc/livraisonsServer.ts
// §7 — Planification des livraisons. Détermine le nombre minimum de NOUVEAUX
// crédits à livrer par jour (Quinzaine / Trentaine / Total) pour atteindre les
// objectifs du mois, en tenant compte des crédits déjà accordés, des crédits
// arrivant à échéance et des revenus attendus. Serveur uniquement.

import { prisma } from "@/lib/prisma";
import { calculerConsolidationDirection } from "@/lib/popc/realisationsServer";

export interface LigneLivraison { date: string; quinzaine: number; trentaine: number; total: number }

export interface PlanLivraisons {
  objectifsGeneres: boolean;
  annee: number;
  mois: number;
  lignes: LigneLivraison[];
  resume: {
    objectifQuinzaine: number; objectifTrentaine: number;
    dejaQuinzaine: number; dejaTrentaine: number;
    resteQuinzaine: number; resteTrentaine: number;
    // Contexte : crédits arrivant à échéance & revenus attendus (§7).
    seiziemesAttendus: number; trentiemesAttendus: number;
    revenusAttendus: number; revenusEncaisses: number;
    joursRestants: number;
  };
}

/** Répartit `total` sur `n` jours aussi uniformément que possible (somme = total). */
function repartir(total: number, n: number): number[] {
  if (n <= 0) return [];
  const t = Math.max(0, Math.round(total));
  const base = Math.floor(t / n);
  let rem = t - base * n;
  return Array.from({ length: n }, () => {
    const v = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem--;
    return v;
  });
}

/** Liste des dates (YYYY-MM-DD, UTC) du début de plan à la fin du mois inclus. */
function joursDePlanification(annee: number, mois: number): string[] {
  const now = new Date();
  const debutMois = new Date(Date.UTC(annee, mois - 1, 1));
  const finMois = new Date(Date.UTC(annee, mois, 0)); // dernier jour du mois
  // On planifie à partir d'aujourd'hui si le mois est en cours, sinon du 1er.
  const aujourdhui = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const depart = aujourdhui > debutMois ? aujourdhui : debutMois;
  if (depart > finMois) return []; // mois passé → plus rien à planifier

  const jours: string[] = [];
  for (let d = new Date(depart); d <= finMois; d.setUTCDate(d.getUTCDate() + 1)) {
    jours.push(d.toISOString().slice(0, 10));
  }
  return jours;
}

/**
 * Planifie les livraisons de nouveaux crédits du mois pour atteindre les objectifs.
 * pdv = 0 → global ; sinon planification par agence.
 */
export async function planifierLivraisons(annee: number, mois: number, pdv = 0): Promise<PlanLivraisons> {
  const vide: PlanLivraisons = {
    objectifsGeneres: false, annee, mois, lignes: [],
    resume: {
      objectifQuinzaine: 0, objectifTrentaine: 0, dejaQuinzaine: 0, dejaTrentaine: 0,
      resteQuinzaine: 0, resteTrentaine: 0, seiziemesAttendus: 0, trentiemesAttendus: 0,
      revenusAttendus: 0, revenusEncaisses: 0, joursRestants: 0,
    },
  };

  const param = await prisma.parametragePOPC.findUnique({
    where: { annee_mois_pointDeVenteId: { annee, mois, pointDeVenteId: pdv } },
    include: { objectif: true },
  });
  if (!param?.objectif) return vide;

  const objectifQuinzaine = param.objectif.nbSeiziemes;
  const objectifTrentaine = param.objectif.nbTrentiemes;

  // Crédits déjà accordés ce mois, par formule (dateDebut dans le mois).
  const debut = new Date(Date.UTC(annee, mois - 1, 1));
  const fin = new Date(Date.UTC(annee, mois, 1));
  const creditPDV = pdv ? { pointDeVenteId: pdv } : {};
  const [dejaQuinzaine, dejaTrentaine] = await Promise.all([
    prisma.creditClient.count({ where: { formule: "QUINZAINE", dateDebut: { gte: debut, lt: fin }, ...creditPDV } }),
    prisma.creditClient.count({ where: { formule: "TRENTAINE", dateDebut: { gte: debut, lt: fin }, ...creditPDV } }),
  ]);

  const resteQuinzaine = Math.max(0, objectifQuinzaine - dejaQuinzaine);
  const resteTrentaine = Math.max(0, objectifTrentaine - dejaTrentaine);

  const jours = joursDePlanification(annee, mois);
  const q = repartir(resteQuinzaine, jours.length);
  const t = repartir(resteTrentaine, jours.length);
  const lignes: LigneLivraison[] = jours.map((date, i) => ({
    date, quinzaine: q[i], trentaine: t[i], total: q[i] + t[i],
  }));

  // Contexte : crédits arrivant à échéance & revenus (réutilise la consolidation).
  const conso = await calculerConsolidationDirection(annee, mois, pdv);

  return {
    objectifsGeneres: true, annee, mois, lignes,
    resume: {
      objectifQuinzaine, objectifTrentaine, dejaQuinzaine, dejaTrentaine,
      resteQuinzaine, resteTrentaine,
      seiziemesAttendus: conso.seiziemesAttendus, trentiemesAttendus: conso.trentiemesAttendus,
      revenusAttendus: conso.revenusAttendus, revenusEncaisses: conso.revenusEncaisses,
      joursRestants: jours.length,
    },
  };
}
