import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/marketing/audiences/[id] — détail + échantillon de membres (50 max).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const { id } = await params;
    const audienceId = Number(id);
    if (isNaN(audienceId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const audience = await prisma.audienceMarketing.findUnique({
      where: { id: audienceId },
      include: {
        creePar: { select: { id: true, nom: true, prenom: true } },
        regles: true,
        campagnes: { select: { id: true, code: true, nom: true, statut: true } },
        membres: {
          take: 50,
          orderBy: { clientId: "asc" },
          include: { client: { select: { id: true, nom: true, prenom: true, telephone: true, ville: true } } },
        },
      },
    });
    if (!audience) return NextResponse.json({ error: "Audience introuvable" }, { status: 404 });

    return NextResponse.json({ data: audience });
  } catch (e) {
    console.error("GET /api/admin/marketing/audiences/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
