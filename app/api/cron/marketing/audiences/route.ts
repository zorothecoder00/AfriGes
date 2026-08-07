import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalculerAudience } from "@/lib/audienceMarketing";

/**
 * GET /api/cron/marketing/audiences
 * Recalcule chaque nuit toutes les audiences DYNAMIQUE (CDC §12 — "Chaque
 * jour, AfriGes recalcule automatiquement l'audience"). Les audiences
 * STATIQUE ne sont pas touchées (figées par définition, CDC §13).
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
    const audiences = await prisma.audienceMarketing.findMany({
      where: { type: "DYNAMIQUE" },
      select: { id: true },
    });

    let recalculees = 0;
    let echecs = 0;
    for (const a of audiences) {
      try {
        await recalculerAudience(a.id);
        recalculees += 1;
      } catch (error) {
        console.error(`CRON marketing/audiences — échec audience ${a.id}:`, error);
        echecs += 1;
      }
    }

    return NextResponse.json({ success: true, total: audiences.length, recalculees, echecs });
  } catch (error) {
    console.error("CRON marketing/audiences error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
