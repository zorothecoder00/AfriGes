import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

// Tableau de bord DG — vision globale de toutes les commissions
export async function GET() {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const now = new Date();

    const [
      membresParCommission,
      reunionsStats,
      resolutionsStats,
      plansStats,
      dossiersStats,
      anomaliesStats,
      rapportsStats,
      prochainReunion,
    ] = await Promise.all([

      // Membres actifs par commission
      prisma.membreCommissionRIA.groupBy({
        by: ["typeCommission"],
        where: { actif: true },
        _count: { id: true },
      }),

      // Réunions par statut
      prisma.reunionCommissionRIA.groupBy({
        by: ["typeCommission", "statut"],
        _count: { id: true },
      }),

      // Résolutions par statut
      prisma.resolutionCommRIA.groupBy({
        by: ["typeCommission", "statut"],
        _count: { id: true },
      }),

      // Plans d'action — en retard
      prisma.planActionCommRIA.groupBy({
        by: ["typeCommission", "statut"],
        _count: { id: true },
      }),

      // Dossiers inter-commissions par statut
      prisma.dossierInterCommission.groupBy({
        by: ["statut"],
        _count: { id: true },
        _sum:  { montantDemande: true, montantApprouve: true },
      }),

      // Anomalies non résolues par niveau
      prisma.anomalieGouvRIA.groupBy({
        by: ["niveau"],
        where: { resolue: false },
        _count: { id: true },
      }),

      // Rapports par statut
      prisma.rapportCommissionRIA.groupBy({
        by: ["statut"],
        _count: { id: true },
      }),

      // Prochain réunion planifiée
      prisma.reunionCommissionRIA.findFirst({
        where: { statut: "PLANIFIEE", dateHeure: { gte: now } },
        orderBy: { dateHeure: "asc" },
        select: { id: true, titre: true, typeCommission: true, dateHeure: true, lieu: true },
      }),
    ]);

    // Calcul du temps moyen de traitement des dossiers
    const dossiersTerm = await prisma.dossierInterCommission.findMany({
      where: { statut: { in: ["APPROUVE", "REJETE", "EXECUTE"] }, dateValidation: { not: null } },
      select: { createdAt: true, dateValidation: true },
    });
    const tempsMoyen = dossiersTerm.length > 0
      ? Math.round(
          dossiersTerm.reduce((s, d) => {
            const diff = new Date(d.dateValidation!).getTime() - new Date(d.createdAt).getTime();
            return s + diff / 86_400_000;
          }, 0) / dossiersTerm.length
        )
      : 0;

    return NextResponse.json({
      membresParCommission,
      reunionsStats,
      resolutionsStats,
      plansStats,
      dossiersStats,
      anomaliesStats,
      rapportsStats,
      prochainReunion,
      tempsMoyenTraitementJours: tempsMoyen,
      genereLe: now.toISOString(),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
