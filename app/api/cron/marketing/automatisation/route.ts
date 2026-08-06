import { NextResponse } from "next/server";
import { executerAutomatisations } from "@/lib/automatisationMarketing";

/**
 * GET /api/cron/marketing/automatisation
 * Détecte les nouveaux candidats aux règles d'automatisation marketing (CDC §18)
 * et fait progresser les séquences en cours (CDC §16-17, actions §19).
 *
 * Sécurité : passer ?secret=CRON_SECRET (voir vercel.json).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const resultats = await executerAutomatisations();
    return NextResponse.json({ success: true, ...resultats });
  } catch (error) {
    console.error("CRON marketing/automatisation error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
