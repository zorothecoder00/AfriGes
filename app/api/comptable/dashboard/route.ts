import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { genererKpisDashboard, genererGraphiquesDashboard } from "@/lib/comptabilite/dashboardComptable";

/**
 * GET /api/comptable/dashboard
 * Centre de pilotage comptable (CDC §4) : 20 KPI + 10 séries de graphiques,
 * dérivés exclusivement d'EcritureComptable/CompteComptable/Immobilisation.
 */
export async function GET() {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const [kpis, graphiques] = await Promise.all([
      genererKpisDashboard(prisma),
      genererGraphiquesDashboard(prisma),
    ]);

    return NextResponse.json({ data: { kpis, graphiques } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
