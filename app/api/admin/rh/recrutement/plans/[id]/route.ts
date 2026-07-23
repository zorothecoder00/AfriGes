import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutPlanAnnuel } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

const STATUTS: StatutPlanAnnuel[] = ["BROUILLON", "VALIDE", "CLOTURE"];

/**
 * PATCH /api/admin/rh/recrutement/plans/[id]
 * Body: { budgetTotal?, effectifCible?, notes?, statut? }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.planRecrutementAnnuel.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });

    const body = await req.json();
    const { budgetTotal, effectifCible, notes, statut } = body;

    if (statut && !STATUTS.includes(statut)) {
      return NextResponse.json({ error: "statut invalide" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (budgetTotal !== undefined)   data.budgetTotal   = budgetTotal ? Number(budgetTotal) : null;
    if (effectifCible !== undefined) data.effectifCible = effectifCible ? Number(effectifCible) : null;
    if (notes !== undefined)         data.notes         = notes || null;
    if (statut !== undefined)        data.statut        = statut;

    const updated = await prisma.planRecrutementAnnuel.update({ where: { id: Number(id) }, data });

    await prisma.auditLog.create({
      data: { userId: parseInt(session.user.id), action: "UPDATE", entite: "PlanRecrutementAnnuel", entiteId: updated.id,
        details: `Plan de recrutement ${updated.annee} modifié` },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/recrutement/plans/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
