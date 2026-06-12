import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import type { NiveauRisque } from "@prisma/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScoreBreakdown {
  historiquePaiement: { pts: number; max: 40; nbEcheances: number; nbEnRetard: number };
  rotation:           { pts: number; max: 30; nbRembourse: number; nbTotal: number };
  volumeAchat:        { pts: number; max: 30; montantTotal: number };
}

interface SolvabiliteResult {
  score:             number;
  niveau:            string;
  recommandation:    string;
  niveauRisquePrisma: NiveauRisque;
  breakdown:         ScoreBreakdown;
}

// ── Algorithme de scoring solvabilité ─────────────────────────────────────────
//
// Score 0–100 basé sur 3 critères :
//
//  1. Historique paiement  (40 pts max)
//     → ratio écheances payées / total écheances actives
//     → PAYE = 1 pt · PARTIEL = 0.5 pt · EN_RETARD = 0 pt · penalite > 0 = malus
//
//  2. Rotation             (30 pts max)
//     → nombre de financements RIA intégralement remboursés (REMBOURSE)
//     → 0 remb. = 0 pts · 1 = 12 · 2 = 20 · 3 = 25 · 4+ = 30
//
//  3. Volume d'achat       (30 pts max)
//     → montant total financé cumulé, par paliers FCFA
//
// Niveaux : Excellent (80+) · Bon (60-79) · Modéré (40-59) · Faible (20-39) · Critique (<20)

function calculerScoreSolvabilite(
  echeances:    { statut: string; penalite: number }[],
  financements: { statut: string; montantFinance: number }[]
): SolvabiliteResult {

  // ── Critère 1 : Historique paiement ──────────────────────────────────────
  const echeancesActives = echeances.filter((e) => e.statut !== "EN_ATTENTE");
  const nbPaye    = echeances.filter((e) => e.statut === "PAYE").length;
  const nbPartiel = echeances.filter((e) => e.statut === "PARTIEL").length;
  const nbEnRetard = echeances.filter((e) => e.statut === "EN_RETARD" || Number(e.penalite) > 0).length;

  let ptsHistorique = 20; // neutre si aucune donnée
  if (echeancesActives.length > 0) {
    const pts = nbPaye + nbPartiel * 0.5;
    ptsHistorique = (pts / echeancesActives.length) * 40;
  }

  // ── Critère 2 : Rotation ─────────────────────────────────────────────────
  const nbRembourse = financements.filter((f) => f.statut === "REMBOURSE").length;
  const nbTotal     = financements.length;
  let ptsRotation   = 0;
  if (nbRembourse >= 4)      ptsRotation = 30;
  else if (nbRembourse === 3) ptsRotation = 25;
  else if (nbRembourse === 2) ptsRotation = 20;
  else if (nbRembourse === 1) ptsRotation = 12;
  else {
    // Aucun remboursement complet → crédit partiel si des financements actifs existent
    const nbActifs = financements.filter((f) => f.statut === "ACTIF").length;
    ptsRotation = Math.min(6, nbActifs * 2);
  }

  // ── Critère 3 : Volume d'achat ────────────────────────────────────────────
  const montantTotal = financements.reduce((s, f) => s + f.montantFinance, 0);
  let ptsVolume = 0;
  if      (montantTotal >= 5_000_000) ptsVolume = 30;
  else if (montantTotal >= 2_000_000) ptsVolume = 26;
  else if (montantTotal >= 1_000_000) ptsVolume = 22;
  else if (montantTotal >= 500_000)   ptsVolume = 17;
  else if (montantTotal >= 200_000)   ptsVolume = 12;
  else if (montantTotal >= 100_000)   ptsVolume = 8;
  else if (montantTotal >= 50_000)    ptsVolume = 5;
  else if (montantTotal > 0)          ptsVolume = 2;

  const score = Math.round(Math.min(100, ptsHistorique + ptsRotation + ptsVolume));

  // ── Niveau, recommandation, NiveauRisque Prisma ───────────────────────────
  let niveau: string;
  let recommandation: string;
  let niveauRisquePrisma: NiveauRisque;

  if (score >= 80) {
    niveau             = "Excellent";
    recommandation     = "Profil excellent — Financement recommandé, augmentation de plafond possible";
    niveauRisquePrisma = "FAIBLE";
  } else if (score >= 60) {
    niveau             = "Bon";
    recommandation     = "Bon profil — Financement standard autorisé";
    niveauRisquePrisma = "FAIBLE";
  } else if (score >= 40) {
    niveau             = "Modéré";
    recommandation     = "Profil modéré — Financement conditionnel (garanties supplémentaires recommandées)";
    niveauRisquePrisma = "MOYEN";
  } else if (score >= 20) {
    niveau             = "Faible";
    recommandation     = "Profil risqué — Financement limité, surveillance accrue requise";
    niveauRisquePrisma = "ELEVE";
  } else {
    niveau             = "Critique";
    recommandation     = "Profil critique — Financement déconseillé, révision du dossier nécessaire";
    niveauRisquePrisma = "CRITIQUE";
  }

  return {
    score,
    niveau,
    recommandation,
    niveauRisquePrisma,
    breakdown: {
      historiquePaiement: { pts: Math.round(ptsHistorique), max: 40, nbEcheances: echeancesActives.length, nbEnRetard },
      rotation:           { pts: ptsRotation, max: 30, nbRembourse, nbTotal },
      volumeAchat:        { pts: ptsVolume, max: 30, montantTotal },
    },
  };
}

// ── GET : liste des clients RIA avec scoring calculé ─────────────────────────

export async function GET(req: Request) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("q") ?? "";

    const clients = await prisma.client.findMany({
      where: {
        affectationsRIA: { some: {} },
        ...(search
          ? {
              OR: [
                { nom:       { contains: search, mode: "insensitive" } },
                { prenom:    { contains: search, mode: "insensitive" } },
                { telephone: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true, nom: true, prenom: true, telephone: true,
        scoreSolvabilite: true, niveauRisque: true,
        financementsRIA: {
          select: {
            statut: true, montantFinance: true,
            creditClient: {
              select: {
                echeances: { select: { statut: true, penalite: true } },
              },
            },
          },
        },
        scoreHistorique: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { scoreSolvabilite: true, niveauRisque: true, raison: true, createdAt: true },
        },
      },
      orderBy: [{ nom: "asc" }],
    });

    const data = clients.map((c) => {
      const echeances    = c.financementsRIA.flatMap((f) =>
        (f.creditClient?.echeances ?? []).map((e) => ({
          statut:   e.statut,
          penalite: Number(e.penalite),
        }))
      );
      const financements = c.financementsRIA.map((f) => ({
        statut:        f.statut,
        montantFinance: Number(f.montantFinance),
      }));

      const resultat = calculerScoreSolvabilite(echeances, financements);

      return {
        id:      c.id,
        nom:     `${c.prenom} ${c.nom}`,
        telephone: c.telephone,
        scoreStocke:     c.scoreSolvabilite !== null ? Number(c.scoreSolvabilite) : null,
        niveauStocke:    c.niveauRisque,
        scoreCalcule:    resultat.score,
        niveau:          resultat.niveau,
        recommandation:  resultat.recommandation,
        breakdown:       resultat.breakdown,
        historiqueScore: c.scoreHistorique.map((h) => ({
          score:    Number(h.scoreSolvabilite),
          niveau:   h.niveauRisque,
          raison:   h.raison,
          date:     h.createdAt,
        })),
      };
    });

    // Répartition par niveau
    const repartition: Record<string, number> = {
      Excellent: 0, Bon: 0, Modéré: 0, Faible: 0, Critique: 0,
    };
    for (const d of data) repartition[d.niveau] = (repartition[d.niveau] ?? 0) + 1;

    const scoreMoyen = data.length > 0
      ? Math.round(data.reduce((s, d) => s + d.scoreCalcule, 0) / data.length)
      : 0;

    return NextResponse.json({ clients: data, repartition, total: data.length, scoreMoyen });
  } catch (error) {
    console.error("GET /api/admin/ria/solvabilite", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ── POST : recalculer et persister les scores ─────────────────────────────────

export async function POST(req: Request) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const clients = await prisma.client.findMany({
      where:  { affectationsRIA: { some: {} } },
      select: {
        id: true, scoreSolvabilite: true,
        financementsRIA: {
          select: {
            statut: true, montantFinance: true,
            creditClient: {
              select: {
                echeances: { select: { statut: true, penalite: true } },
              },
            },
          },
        },
      },
    });

    let nbMaj = 0;

    await prisma.$transaction(async (tx) => {
      for (const c of clients) {
        const echeances    = c.financementsRIA.flatMap((f) =>
          (f.creditClient?.echeances ?? []).map((e) => ({
            statut:   e.statut,
            penalite: Number(e.penalite),
          }))
        );
        const financements = c.financementsRIA.map((f) => ({
          statut:         f.statut,
          montantFinance: Number(f.montantFinance),
        }));

        const { score, niveauRisquePrisma } = calculerScoreSolvabilite(echeances, financements);

        const scoreActuel = c.scoreSolvabilite !== null ? Number(c.scoreSolvabilite) : null;
        if (scoreActuel !== score) {
          await tx.client.update({
            where: { id: c.id },
            data:  { scoreSolvabilite: score, niveauRisque: niveauRisquePrisma },
          });
          await tx.clientScoreHistorique.create({
            data: {
              clientId:         c.id,
              scoreSolvabilite: score,
              niveauRisque:     niveauRisquePrisma,
              raison:           "RECALCUL_AUTO",
              calculePar:       session.user.id ? parseInt(session.user.id) : undefined,
            },
          });
          nbMaj++;
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: `${nbMaj} score(s) mis à jour sur ${clients.length} clients traités.`,
      nbMaj,
      nbTotal: clients.length,
    });
  } catch (error) {
    console.error("POST /api/admin/ria/solvabilite", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
