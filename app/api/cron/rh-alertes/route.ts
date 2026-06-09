import { NextResponse } from "next/server";
import { runAlertesRH } from "@/lib/notificationsRH";

/**
 * GET /api/cron/rh-alertes
 * Déclenche les alertes automatiques RH (Module OGRH).
 *
 * À appeler quotidiennement via un job CRON (ex: 07h00).
 * Vercel cron (vercel.json) :
 *   { "crons": [{ "path": "/api/cron/rh-alertes", "schedule": "0 7 * * *" }] }
 *
 * Sécurité : ?secret=CRON_SECRET
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAlertesRH();
    return NextResponse.json({
      success: true,
      message: `${result.total} notification(s) RH envoyée(s).`,
      detail:  {
        "Fin de contrat":       result.finContrat,
        "Documents expirants":  result.documentsExpirants,
        "Évaluations prog.":    result.evaluationsProg,
        "Formations à suivre":  result.formationsAsuivre,
      },
    });
  } catch (error) {
    console.error("CRON rh-alertes error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
