import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableLectureSession } from "@/lib/authComptable";
import { genererKpisDashboard, genererGraphiquesDashboard, genererEcrituresAttente } from "@/lib/comptabilite/dashboardComptable";

/**
 * GET /api/comptable/dashboard
 * Centre de pilotage comptable (CDC §4) : 20 KPI + 10 séries de graphiques,
 * dérivés exclusivement d'EcritureComptable/CompteComptable/Immobilisation.
 * `ecrituresAttente` (CDC §41) : détail des lignes du compte d'attente 471 non résolues.
 * Lecture seule — ouvert aux rôles de consultation (CDC §43).
 */
export async function GET() {
  try {
    const session = await getComptableLectureSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const [kpis, graphiques, ecrituresAttente] = await Promise.all([
      genererKpisDashboard(prisma),
      genererGraphiquesDashboard(prisma),
      genererEcrituresAttente(prisma),
    ]);

    return NextResponse.json({ data: { kpis, graphiques, ecrituresAttente } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
