import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { calculerSegmentsRFM, type SegmentRFM } from "@/lib/audienceMarketing";

/**
 * GET /api/admin/marketing/audiences/rfm
 * Segmentation RFM courante (CDC §14) — calculée à la volée, sans persister
 * d'audience à chaque appel. Retourne les effectifs par segment + un
 * échantillon de clients par segment pour aperçu rapide.
 */
export async function GET() {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const resultats = await calculerSegmentsRFM();

    const parSegment = new Map<SegmentRFM, typeof resultats>();
    for (const r of resultats) {
      const arr = parSegment.get(r.segment) ?? [];
      arr.push(r);
      parSegment.set(r.segment, arr);
    }

    const clientIdsEchantillon = [...parSegment.values()].flatMap((arr) => arr.slice(0, 10).map((r) => r.clientId));
    const clients = await prisma.client.findMany({
      where: { id: { in: clientIdsEchantillon } },
      select: { id: true, nom: true, prenom: true, telephone: true },
    });
    const clientMap = new Map(clients.map((c) => [c.id, c]));

    const segments = [...parSegment.entries()].map(([segment, membres]) => ({
      segment,
      effectif: membres.length,
      echantillon: membres.slice(0, 10).map((m) => ({ ...m, client: clientMap.get(m.clientId) ?? null })),
    }));

    return NextResponse.json({ data: { segments, totalClients: resultats.length } });
  } catch (e) {
    console.error("GET /api/admin/marketing/audiences/rfm", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
