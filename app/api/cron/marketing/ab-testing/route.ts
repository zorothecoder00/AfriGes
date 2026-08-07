import { NextResponse } from "next/server";
import { evaluerConversionsTestAB, cloturerTestsExpires } from "@/lib/testAB";

/**
 * GET /api/cron/marketing/ab-testing
 * Détecte les conversions des tests A/B en cours et clôture les tests expirés
 * (CDC §7, Phase 7). Même gabarit CRON_SECRET que les autres crons marketing.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const conversions = await evaluerConversionsTestAB();
    const cloture = await cloturerTestsExpires();
    return NextResponse.json({ success: true, conversions, cloture });
  } catch (error) {
    console.error("CRON marketing/ab-testing error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
