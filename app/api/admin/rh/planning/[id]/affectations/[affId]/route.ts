import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string; affId: string }> };

/**
 * PATCH /api/admin/rh/planning/[id]/affectations/[affId]
 * Body: { date?, heureDebut?, heureFin?, role?, notes? }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { affId } = await params;
    const existing = await prisma.affectationPlanning.findUnique({ where: { id: Number(affId) } });
    if (!existing) return NextResponse.json({ error: "Affectation introuvable" }, { status: 404 });

    const body = await req.json();
    const { date, heureDebut, heureFin, role, notes } = body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (date !== undefined)       data.date       = new Date(date);
    if (heureDebut !== undefined) data.heureDebut = String(heureDebut);
    if (heureFin !== undefined)   data.heureFin   = String(heureFin);
    if (role !== undefined)       data.role       = role || null;
    if (notes !== undefined)      data.notes      = notes || null;

    const updated = await prisma.affectationPlanning.update({
      where: { id: Number(affId) },
      data,
      include: {
        profilRH: {
          select: {
            id: true, matricule: true,
            gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: { userId: parseInt(session.user.id), action: "UPDATE", entite: "AffectationPlanning", entiteId: updated.id,
        details: `Affectation #${affId} modifiée` },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/planning/[id]/affectations/[affId]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/rh/planning/[id]/affectations/[affId]
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { affId } = await params;
    const existing = await prisma.affectationPlanning.findUnique({ where: { id: Number(affId) } });
    if (!existing) return NextResponse.json({ error: "Affectation introuvable" }, { status: 404 });

    await prisma.affectationPlanning.delete({ where: { id: Number(affId) } });

    await prisma.auditLog.create({
      data: { userId: parseInt(session.user.id), action: "DELETE", entite: "AffectationPlanning", entiteId: Number(affId),
        details: `Affectation #${affId} supprimée` },
    });

    return NextResponse.json({ data: { id: Number(affId) } });
  } catch (error) {
    console.error("DELETE /api/admin/rh/planning/[id]/affectations/[affId]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
