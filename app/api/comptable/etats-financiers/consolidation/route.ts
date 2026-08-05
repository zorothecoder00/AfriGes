import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableLectureSession } from "@/lib/authComptable";
import { genererConsolidation } from "@/lib/comptabilite/consolidation";

/**
 * GET /api/comptable/etats-financiers/consolidation?annee=2026
 * CDC §50 — consolidation multi-société (version légère, simple addition, pas
 * d'élimination inter-sociétés). Voir lib/comptabilite/consolidation.ts.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getComptableLectureSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const currentYear = new Date().getFullYear();
    const annee = Math.min(currentYear + 1, Math.max(2020, Number(req.nextUrl.searchParams.get("annee") ?? currentYear)));
    const dateDebut = new Date(annee, 0, 1);
    const dateFin = new Date(annee, 11, 31, 23, 59, 59, 999);

    const data = await genererConsolidation(prisma, dateDebut, dateFin);
    return NextResponse.json({ data: { annee, ...data } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
