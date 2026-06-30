import { NextResponse } from "next/server";
import { evaluerRetardsRIA } from "@/lib/riaRecouvrement";

/**
 * GET /api/cron/ria/retards
 * Scénario de défaillance client RIA — escalade automatique des retards.
 *
 * À appeler via le cron Vercel (vercel.json) chaque jour :
 *   { "crons": [{ "path": "/api/cron/ria/retards?secret=${CRON_SECRET}", "schedule": "0 7 * * *" }] }
 *
 * Sécurité : passer ?secret=CRON_SECRET (ou ne pas définir CRON_SECRET pour désactiver le contrôle).
 * Réutilisable en mode « lazy » : importer evaluerRetardsRIA() depuis une page recouvrement.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const r = await evaluerRetardsRIA();
    return NextResponse.json({
      success: true,
      message: `${r.escalades} dossier(s) escaladé(s) sur ${r.enRetard} en retard (${r.paliersFranchis} palier(s) franchi(s)).`,
      ...r,
    });
  } catch (error) {
    console.error("CRON ria/retards error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
