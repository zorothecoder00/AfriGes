import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/rh/formations/stats
 * KPIs formation : taux, budget, certifications, heures, répartition par type.
 * Query: annee?
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const annee = searchParams.get("annee");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dateFilter: any = annee ? {
      gte: new Date(`${annee}-01-01`),
      lt:  new Date(`${Number(annee) + 1}-01-01`),
    } : undefined;

    const [
      totalCollabsActifs,
      formationsTerminees,
      allFormations,
      statsByType,
      statsByStatut,
      participations,
      certifications,
    ] = await Promise.all([
      // Nombre de collaborateurs actifs
      prisma.profilRH.count({ where: { statut: "ACTIF" } }),

      // Formations terminées (pour budget + heures)
      prisma.formation.findMany({
        where: { statut: "TERMINEE", ...(dateFilter ? { dateDebut: dateFilter } : {}) },
        select: { cout: true, budgetAlloue: true, dureeHeures: true, type: true },
      }),

      // Toutes formations de l'année
      prisma.formation.findMany({
        where: dateFilter ? { dateDebut: dateFilter } : {},
        select: { id: true, type: true, statut: true, budgetAlloue: true, cout: true, dureeHeures: true },
      }),

      // Répartition par type
      prisma.formation.groupBy({
        by: ["type"],
        _count: { id: true },
        where: dateFilter ? { dateDebut: dateFilter } : {},
      }),

      // Répartition par statut
      prisma.formation.groupBy({
        by: ["statut"],
        _count: { id: true },
        where: dateFilter ? { dateDebut: dateFilter } : {},
      }),

      // Participations pour calcul taux de formation
      prisma.participationFormation.findMany({
        where: {
          formation: {
            statut: { in: ["EN_COURS", "TERMINEE"] },
            ...(dateFilter ? { dateDebut: dateFilter } : {}),
          },
        },
        select: { profilRHId: true, statut: true, note: true },
      }),

      // Certifications obtenues
      prisma.participationFormation.count({
        where: {
          statut: "CERTIFIE",
          formation: dateFilter ? { dateDebut: dateFilter } : {},
        },
      }),
    ]);

    // Collaborateurs formés (unique profilRHId)
    const collabsFormesIds = new Set(participations.map((p) => p.profilRHId));
    const tauxFormation    = totalCollabsActifs > 0
      ? Math.round((collabsFormesIds.size / totalCollabsActifs) * 100) : 0;

    // Budget
    const budgetAlloue = allFormations.reduce((s, f) => s + (f.budgetAlloue ? Number(f.budgetAlloue) : 0), 0);
    const budgetDepense = formationsTerminees.reduce((s, f) => s + (f.cout ? Number(f.cout) : 0), 0);

    // Heures totales
    const heuresTotales = formationsTerminees.reduce((s, f) => s + (f.dureeHeures ?? 0), 0);

    // Notes moyennes
    const notees      = participations.filter((p) => p.note !== null);
    const noteMoyenne = notees.length > 0
      ? Math.round((notees.reduce((s, p) => s + Number(p.note), 0) / notees.length) * 10) / 10 : null;

    // Stats par type
    const typeStats = Object.fromEntries(statsByType.map((s) => [String(s.type), s._count.id]));
    const statutStats = Object.fromEntries(statsByStatut.map((s) => [s.statut, s._count.id]));

    // Taux présence (PRESENT + CERTIFIE) / total inscrits
    const totalInscrits = participations.length;
    const totalPresents = participations.filter((p) => ["PRESENT", "CERTIFIE"].includes(p.statut)).length;
    const tauxPresence  = totalInscrits > 0 ? Math.round((totalPresents / totalInscrits) * 100) : 0;

    return NextResponse.json({
      tauxFormation,         // % collabs formés
      tauxPresence,          // % participants présents ou certifiés
      collabsFormes:    collabsFormesIds.size,
      totalCollabsActifs,
      certifications,        // nb certifications obtenues
      budgetAlloue,
      budgetDepense,
      heuresTotales,
      noteMoyenne,
      totalFormations:  allFormations.length,
      typeStats,             // { INTERNE: n, EXTERNE: n, ELEARNING: n }
      statutStats,
    });
  } catch (error) {
    console.error("GET /api/admin/rh/formations/stats", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
