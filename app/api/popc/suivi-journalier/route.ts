import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPOPCSession } from "@/lib/popc/authPOPC";
import { calculerSuiviJournalier } from "@/lib/popc/realisationsServer";

export const runtime = "nodejs";

/**
 * GET /api/popc/suivi-journalier?date=YYYY-MM-DD&pointDeVenteId=
 * Tableau de suivi journalier (CDC §8) : objectif / réalisé / reste, temps réel.
 */
export async function GET(req: Request) {
  const ctx = await getPOPCSession();
  if (!ctx || !ctx.capacites.consulter) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);

  let pdv = Number(searchParams.get("pointDeVenteId")) || 0;
  if (ctx.capacites.portee === "agence") {
    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: ctx.userId, actif: true }, select: { pointDeVenteId: true },
    });
    pdv = aff?.pointDeVenteId ?? 0;
  }

  const data = await calculerSuiviJournalier(date, pdv);
  return NextResponse.json({ data });
}
