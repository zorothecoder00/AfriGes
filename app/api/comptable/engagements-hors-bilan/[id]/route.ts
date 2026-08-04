import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/comptable/engagements-hors-bilan/[id] — Body: { statut?: "LEVE", notes? } */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { statut, notes } = body as { statut?: string; notes?: string };
    if (statut !== undefined && statut !== "ACTIF" && statut !== "LEVE") {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }

    const existing = await prisma.engagementHorsBilan.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "Engagement introuvable" }, { status: 404 });

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.engagementHorsBilan.update({
        where: { id: Number(id) },
        data: {
          ...(statut !== undefined && { statut: statut as never, ...(statut === "LEVE" && !existing.dateLevee && { dateLevee: new Date() }) }),
          ...(notes !== undefined && { notes: notes || null }),
        },
      });
      await auditLog(tx, userId, "MODIFICATION_ENGAGEMENT_HORS_BILAN", "EngagementHorsBilan", u.id, { statutAvant: existing.statut, statutApres: u.statut }, meta);
      return u;
    });

    return NextResponse.json({ data: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
