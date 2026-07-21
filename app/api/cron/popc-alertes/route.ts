import { NextResponse } from "next/server";
import { diffuserAlertesPOPC } from "@/lib/popc/alertesServer";

export const runtime = "nodejs";

/**
 * GET /api/cron/popc-alertes
 * Évalue et diffuse automatiquement les alertes POPC du mois courant (CDC §12).
 * Cron quotidien. Sécurité : ?secret=CRON_SECRET (désactivable si CRON_SECRET vide).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const { envoyees } = await diffuserAlertesPOPC(now.getFullYear(), now.getMonth() + 1, null);
    return NextResponse.json({ success: true, message: `${envoyees} alerte(s) diffusée(s).`, envoyees });
  } catch (error) {
    console.error("CRON popc-alertes error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
