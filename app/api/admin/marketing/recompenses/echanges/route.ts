import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";

/**
 * GET /api/admin/marketing/recompenses/echanges
 * Historique des échanges de récompenses (CDC §36). Query: clientId (optionnel).
 */
export async function GET(req: Request) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    const echanges = await prisma.recompenseEchange.findMany({
      where: clientId ? { compteFidelite: { clientId: Number(clientId) } } : {},
      orderBy: { createdAt: "desc" },
      include: {
        recompense: { select: { id: true, nom: true, type: true, coutPoints: true } },
        compteFidelite: { select: { client: { select: { id: true, nom: true, prenom: true } } } },
        creePar: { select: { id: true, nom: true, prenom: true } },
      },
    });

    return NextResponse.json({ data: echanges });
  } catch (e) {
    console.error("GET /api/admin/marketing/recompenses/echanges", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
