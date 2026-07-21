import { NextResponse } from "next/server";
import { getPOPCSession } from "@/lib/popc/authPOPC";
import { genererTournee } from "@/lib/popc/tourneeServer";

export const runtime = "nodejs";

/**
 * GET /api/popc/tournee?date=YYYY-MM-DD&agentId=
 * Tournée automatique du jour d'un commercial (CDC §10).
 * - AGENT_TERRAIN (portée « perso ») : forcé sur SA propre tournée.
 * - Profils direction/consultation : peuvent cibler un agent via ?agentId=.
 */
export async function GET(req: Request) {
  const ctx = await getPOPCSession();
  if (!ctx || !ctx.capacites.consulter) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);

  let agentId: number;
  if (ctx.capacites.portee === "perso") {
    agentId = ctx.userId;
  } else {
    const q = Number(searchParams.get("agentId"));
    if (!q) return NextResponse.json({ error: "Paramètre agentId requis" }, { status: 400 });
    agentId = q;
  }

  const lignes = await genererTournee(agentId, date);
  const totalACollecter = lignes.reduce((s, l) => s + l.montantACollecter, 0);
  return NextResponse.json({
    data: lignes,
    meta: {
      date, agentId, total: lignes.length,
      totalACollecter: Number(totalACollecter.toFixed(2)),
      urgentes: lignes.filter((l) => l.priorite === "URGENTE").length,
    },
  });
}
