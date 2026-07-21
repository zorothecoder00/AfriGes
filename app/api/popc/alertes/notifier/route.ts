import { NextResponse } from "next/server";
import { getPOPCSession } from "@/lib/popc/authPOPC";
import { diffuserAlertesPOPC } from "@/lib/popc/alertesServer";

export const runtime = "nodejs";

/**
 * POST /api/popc/alertes/notifier
 * Évalue les alertes du mois puis les diffuse par notification (CDC §12).
 * Réservé aux profils disposant de la capacité `modifier`.
 */
export async function POST(req: Request) {
  const ctx = await getPOPCSession();
  if (!ctx || !ctx.capacites.modifier) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const now = new Date();
  const annee = Number(body.annee) || now.getFullYear();
  const mois = Number(body.mois) || now.getMonth() + 1;

  const { envoyees } = await diffuserAlertesPOPC(annee, mois, ctx.userId);
  return NextResponse.json({
    data: { envoyees },
    message: envoyees === 0 ? "Aucune alerte à diffuser" : `${envoyees} alerte(s) diffusée(s)`,
  });
}
