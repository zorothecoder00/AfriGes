import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutActionDeveloppement } from "@prisma/client";

type Ctx = { params: Promise<{ id: string; actionId: string }> };

const STATUTS: StatutActionDeveloppement[] = ["A_FAIRE", "EN_COURS", "REALISE", "ANNULE"];

/**
 * PATCH /api/admin/rh/evaluations/[id]/actions/[actionId]
 * Body: { objectif?, actionPrevue?, echeance?, statut?, notes? }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { actionId } = await params;
    const existing = await prisma.actionDeveloppement.findUnique({ where: { id: Number(actionId) } });
    if (!existing) return NextResponse.json({ error: "Action introuvable" }, { status: 404 });

    const body = await req.json();
    const { objectif, actionPrevue, echeance, statut, notes } = body;

    if (statut && !STATUTS.includes(statut)) {
      return NextResponse.json({ error: "statut invalide" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (objectif !== undefined)     data.objectif     = String(objectif).trim();
    if (actionPrevue !== undefined) data.actionPrevue = actionPrevue || null;
    if (echeance !== undefined)     data.echeance     = echeance ? new Date(echeance) : null;
    if (statut !== undefined)       data.statut       = statut;
    if (notes !== undefined)        data.notes        = notes || null;

    const updated = await prisma.actionDeveloppement.update({ where: { id: Number(actionId) }, data });

    await prisma.auditLog.create({
      data: { userId: parseInt(session.user.id), action: "UPDATE", entite: "ActionDeveloppement", entiteId: updated.id,
        details: `Action PDI #${actionId} modifiée` },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/evaluations/[id]/actions/[actionId]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/rh/evaluations/[id]/actions/[actionId]
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { actionId } = await params;
    const existing = await prisma.actionDeveloppement.findUnique({ where: { id: Number(actionId) } });
    if (!existing) return NextResponse.json({ error: "Action introuvable" }, { status: 404 });

    await prisma.actionDeveloppement.delete({ where: { id: Number(actionId) } });

    await prisma.auditLog.create({
      data: { userId: parseInt(session.user.id), action: "DELETE", entite: "ActionDeveloppement", entiteId: Number(actionId),
        details: `Action PDI #${actionId} supprimée` },
    });

    return NextResponse.json({ data: { id: Number(actionId) } });
  } catch (error) {
    console.error("DELETE /api/admin/rh/evaluations/[id]/actions/[actionId]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
