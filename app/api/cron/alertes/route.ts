import { NextResponse } from "next/server";
import { runAlertes } from "@/lib/alertesSystem";

/**
 * GET /api/cron/alertes
 * Déclenche les 5 vérifications d'alertes automatiques (Module 9).
 *
 * À appeler via un job CRON chaque jour (ex: 08h00).
 * Exemple Vercel cron (vercel.json) :
 *   { "crons": [{ "path": "/api/cron/alertes", "schedule": "0 8 * * *" }] }
 *
 * Sécurité : passer ?secret=CRON_SECRET ou définir CRON_SECRET="" pour désactiver.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const resultats = await runAlertes();
    return NextResponse.json({
      success: true,
      message: `${resultats.total} alerte(s) envoyée(s).`,
      ...resultats,
    });
  } catch (error) {
    console.error("CRON alertes error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
