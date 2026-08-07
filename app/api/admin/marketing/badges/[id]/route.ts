import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/marketing/badges/[id] — détail + clients badgés. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const { id } = await params;
    const badgeId = Number(id);
    if (isNaN(badgeId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const badge = await prisma.badgeMarketing.findUnique({
      where: { id: badgeId },
      include: {
        attributions: {
          orderBy: { dateAttribution: "desc" },
          include: { client: { select: { id: true, nom: true, prenom: true } } },
        },
      },
    });
    if (!badge) return NextResponse.json({ error: "Badge introuvable" }, { status: 404 });

    return NextResponse.json({ data: badge });
  } catch (e) {
    console.error("GET /api/admin/marketing/badges/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** PATCH /api/admin/marketing/badges/[id] — édition (actif surtout). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "MODIFICATION");
    if (denied) return denied;

    const { id } = await params;
    const badgeId = Number(id);
    if (isNaN(badgeId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { nom, description, icone, actif } = body;
    const userId = Number(session.user.id);

    const badge = await prisma.$transaction(async (tx) => {
      const updated = await tx.badgeMarketing.update({
        where: { id: badgeId },
        data: {
          ...(nom !== undefined ? { nom } : {}),
          ...(description !== undefined ? { description: description || null } : {}),
          ...(icone !== undefined ? { icone: icone || null } : {}),
          ...(actif !== undefined ? { actif: Boolean(actif) } : {}),
        },
      });
      await auditLog(tx, userId, "UPDATE", "BadgeMarketing", badgeId, { actif });
      return updated;
    });

    return NextResponse.json({ data: badge });
  } catch (e) {
    console.error("PATCH /api/admin/marketing/badges/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
