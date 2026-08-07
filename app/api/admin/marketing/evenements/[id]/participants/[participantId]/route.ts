import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";

type Ctx = { params: Promise<{ id: string; participantId: string }> };

/** PATCH /api/admin/marketing/evenements/[id]/participants/[participantId] — statut (inscrit/présent/absent). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "MODIFICATION");
    if (denied) return denied;

    const { participantId } = await params;
    const pid = Number(participantId);
    if (isNaN(pid)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { statut } = body;
    if (!["INVITE", "INSCRIT", "PRESENT", "ABSENT"].includes(statut)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }

    const participant = await prisma.participantEvenement.update({ where: { id: pid }, data: { statut } });
    return NextResponse.json({ data: participant });
  } catch (e) {
    console.error("PATCH /api/admin/marketing/evenements/[id]/participants/[participantId]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
