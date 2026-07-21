import { NextResponse } from "next/server";
import { getPOPCSession } from "@/lib/popc/authPOPC";
import { calculerTableauCommercial } from "@/lib/popc/realisationsServer";

export const runtime = "nodejs";

/**
 * GET /api/popc/commercial?annee=&mois=&agentId=
 * Tableau de bord personnel du commercial (CDC §9).
 * - AGENT_TERRAIN (portée « perso ») : forcé sur SES propres données.
 * - Profils direction/consultation : peuvent cibler un agent via ?agentId=.
 */
export async function GET(req: Request) {
  const ctx = await getPOPCSession();
  if (!ctx || !ctx.capacites.consulter) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const annee = Number(searchParams.get("annee")) || now.getFullYear();
  const mois = Number(searchParams.get("mois")) || now.getMonth() + 1;

  // Le commercial ne voit QUE ses propres données (§9).
  let agentId: number;
  if (ctx.capacites.portee === "perso") {
    agentId = ctx.userId;
  } else {
    const q = Number(searchParams.get("agentId"));
    if (!q) return NextResponse.json({ error: "Paramètre agentId requis" }, { status: 400 });
    agentId = q;
  }

  const data = await calculerTableauCommercial(agentId, annee, mois);
  return NextResponse.json({ data });
}
