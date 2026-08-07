import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/marketing/evenements/[id] — détail + participants. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const { id } = await params;
    const evenementId = Number(id);
    if (isNaN(evenementId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const evenement = await prisma.evenementMarketing.findUnique({
      where: { id: evenementId },
      include: {
        campagne: { select: { id: true, code: true, nom: true } },
        participants: { orderBy: { createdAt: "desc" }, include: { client: { select: { id: true, nom: true, prenom: true } } } },
      },
    });
    if (!evenement) return NextResponse.json({ error: "Événement introuvable" }, { status: 404 });

    return NextResponse.json({ data: { ...evenement, budget: Number(evenement.budget) } });
  } catch (e) {
    console.error("GET /api/admin/marketing/evenements/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** PATCH /api/admin/marketing/evenements/[id] — édition/statut. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "MODIFICATION");
    if (denied) return denied;

    const { id } = await params;
    const evenementId = Number(id);
    if (isNaN(evenementId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { nom, lieu, statut, budget } = body;
    const userId = Number(session.user.id);

    const evenement = await prisma.$transaction(async (tx) => {
      const updated = await tx.evenementMarketing.update({
        where: { id: evenementId },
        data: {
          ...(nom !== undefined ? { nom } : {}),
          ...(lieu !== undefined ? { lieu: lieu || null } : {}),
          ...(statut !== undefined ? { statut } : {}),
          ...(budget !== undefined ? { budget: Number(budget) } : {}),
        },
      });
      await auditLog(tx, userId, "UPDATE", "EvenementMarketing", evenementId, { statut });
      return updated;
    });

    return NextResponse.json({ data: { ...evenement, budget: Number(evenement.budget) } });
  } catch (e) {
    console.error("PATCH /api/admin/marketing/evenements/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
