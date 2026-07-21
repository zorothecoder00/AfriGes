import { NextResponse } from "next/server";
import { getPOPCSession } from "@/lib/popc/authPOPC";
import { evaluerAlertesPOPC } from "@/lib/popc/alertesServer";

export const runtime = "nodejs";

/**
 * GET /api/popc/alertes?annee=&mois=
 * Alertes automatiques du mois (CDC §12) — affichage tableau de bord.
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

  const alertes = await evaluerAlertesPOPC(annee, mois);
  return NextResponse.json({ data: alertes, meta: { annee, mois, total: alertes.length } });
}
