import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/admin/marketing/challenges/[id] — édition/clôture. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "MODIFICATION");
    if (denied) return denied;

    const { id } = await params;
    const challengeId = Number(id);
    if (isNaN(challengeId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { nom, description, statut, dateFin } = body;
    const userId = Number(session.user.id);

    const challenge = await prisma.$transaction(async (tx) => {
      const updated = await tx.challengeMarketing.update({
        where: { id: challengeId },
        data: {
          ...(nom !== undefined ? { nom } : {}),
          ...(description !== undefined ? { description: description || null } : {}),
          ...(statut !== undefined ? { statut } : {}),
          ...(dateFin !== undefined ? { dateFin: new Date(dateFin) } : {}),
        },
      });
      await auditLog(tx, userId, "UPDATE", "ChallengeMarketing", challengeId, { statut });
      return updated;
    });

    return NextResponse.json({ data: challenge });
  } catch (e) {
    console.error("PATCH /api/admin/marketing/challenges/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
