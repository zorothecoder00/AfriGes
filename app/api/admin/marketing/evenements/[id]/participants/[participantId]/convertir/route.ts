import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";
import { convertirParticipantEnClient } from "@/lib/evenementMarketing";

type Ctx = { params: Promise<{ id: string; participantId: string }> };

/**
 * POST /api/admin/marketing/evenements/[id]/participants/[participantId]/convertir
 * Convertit un participant présent en Client (CDC §85 — pas de table leads).
 */
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "CREATION");
    if (denied) return denied;

    const { participantId } = await params;
    const pid = Number(participantId);
    if (isNaN(pid)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const userId = Number(session.user.id);
    try {
      const client = await prisma.$transaction(async (tx) => {
        const c = await convertirParticipantEnClient(tx, { participantId: pid });
        await auditLog(tx, userId, "CREATION_CLIENT_EVENEMENT", "Client", c.id);
        return c;
      });
      return NextResponse.json({ data: client }, { status: 201 });
    } catch (e) {
      if (e instanceof Error && e.message === "PARTICIPANT_INTROUVABLE") return NextResponse.json({ error: "Participant introuvable" }, { status: 404 });
      throw e;
    }
  } catch (e) {
    console.error("POST .../participants/[participantId]/convertir", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
