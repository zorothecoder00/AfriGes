import { NextResponse } from "next/server";
import { autoCloseOldSessions } from "@/lib/collecteAutoClose";

/**
 * GET /api/cron/collectes-autoclose
 * Clôture automatiquement toutes les sessions de collecte EN_COURS
 * dont la date est antérieure à aujourd'hui.
 *
 * À appeler via un job CRON chaque jour à 00:00.
 * Exemple Vercel cron (vercel.json) :
 *   { "crons": [{ "path": "/api/cron/collectes-autoclose", "schedule": "0 0 * * *" }] }
 */
export async function GET(req: Request) {
  // Sécurité basique : vérifier un secret en-tête ou query param
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (
    process.env.CRON_SECRET &&
    secret !== process.env.CRON_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const closed = await autoCloseOldSessions();
    return NextResponse.json({
      success: true,
      message: `${closed} session(s) clôturée(s) automatiquement.`,
      closed,
    });
  } catch (error) {
    console.error("CRON collectes-autoclose error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
