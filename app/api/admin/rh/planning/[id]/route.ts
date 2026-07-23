import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

const INCLUDE = {
  affectations: {
    orderBy: [{ date: "asc" as const }, { heureDebut: "asc" as const }],
    include: {
      profilRH: {
        select: {
          id: true, matricule: true,
          gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
        },
      },
    },
  },
};

/**
 * GET /api/admin/rh/planning/[id]
 * Détail d'un planning d'équipe avec toutes ses affectations.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const planning = await prisma.planningEquipe.findUnique({ where: { id: Number(id) }, include: INCLUDE });
    if (!planning) return NextResponse.json({ error: "Planning introuvable" }, { status: 404 });

    return NextResponse.json({ data: planning });
  } catch (error) {
    console.error("GET /api/admin/rh/planning/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/rh/planning/[id]
 * Body: { action: "PUBLIER" | "REPASSER_BROUILLON" } ou { notes }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.planningEquipe.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "Planning introuvable" }, { status: 404 });

    const body = await req.json();
    const { action, notes } = body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (action === "PUBLIER") data.statut = "PUBLIE";
    else if (action === "REPASSER_BROUILLON") data.statut = "BROUILLON";
    else if (action) return NextResponse.json({ error: "Action invalide" }, { status: 400 });
    if (notes !== undefined) data.notes = notes || null;

    const updated = await prisma.planningEquipe.update({ where: { id: Number(id) }, data, include: INCLUDE });

    await prisma.auditLog.create({
      data: { userId: parseInt(session.user.id), action: "UPDATE", entite: "PlanningEquipe", entiteId: updated.id,
        details: `Planning #${id} modifié${action ? ` (${action})` : ""}` },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/planning/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/rh/planning/[id]
 * Supprime un planning (et ses affectations) — réservé aux plannings en brouillon.
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.planningEquipe.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "Planning introuvable" }, { status: 404 });
    if (existing.statut === "PUBLIE") {
      return NextResponse.json({ error: "Impossible de supprimer un planning publié." }, { status: 422 });
    }

    await prisma.planningEquipe.delete({ where: { id: Number(id) } });

    await prisma.auditLog.create({
      data: { userId: parseInt(session.user.id), action: "DELETE", entite: "PlanningEquipe", entiteId: Number(id),
        details: `Planning #${id} supprimé` },
    });

    return NextResponse.json({ data: { id: Number(id) } });
  } catch (error) {
    console.error("DELETE /api/admin/rh/planning/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
