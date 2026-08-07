import { NextResponse } from "next/server";
import { evaluerChallenges, evaluerBadges } from "@/lib/gamificationMarketing";
import { evaluerParrainagesQualifies } from "@/lib/parrainage";

/**
 * GET /api/cron/marketing/fidelisation
 * Orchestre l'évaluation planifiée de la Fidélisation (CDC §36-37, §84) :
 * progression des challenges, attribution des badges, qualification des
 * parrainages. Distinct du cron Automation (Phase 4) — pas le même domaine.
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
    // Séquentiel (pas parallèle) : evaluerChallenges peut faire monter un niveau
    // de fidélité que evaluerBadges lit ensuite (condition NIVEAU_FIDELITE).
    const challenges = await evaluerChallenges();
    const badges = await evaluerBadges();
    const parrainages = await evaluerParrainagesQualifies();
    return NextResponse.json({ success: true, challenges, badges, parrainages });
  } catch (error) {
    console.error("CRON marketing/fidelisation error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
