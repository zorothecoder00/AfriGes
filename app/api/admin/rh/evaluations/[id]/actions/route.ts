import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/rh/evaluations/[id]/actions
 * Liste les actions structurées du plan de développement individuel (PDI)
 * rattachées à une évaluation.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const actions = await prisma.actionDeveloppement.findMany({
      where:   { evaluationId: Number(id) },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ data: actions });
  } catch (error) {
    console.error("GET /api/admin/rh/evaluations/[id]/actions", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/evaluations/[id]/actions
 * Body: { objectif, actionPrevue?, echeance? }
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const evaluation = await prisma.evaluationRH.findUnique({ where: { id: Number(id) } });
    if (!evaluation) return NextResponse.json({ error: "Évaluation introuvable" }, { status: 404 });

    const body = await req.json();
    const { objectif, actionPrevue, echeance, notes } = body;
    if (!objectif || !String(objectif).trim()) {
      return NextResponse.json({ error: "objectif est obligatoire" }, { status: 400 });
    }

    const action = await prisma.actionDeveloppement.create({
      data: {
        evaluationId: Number(id),
        profilRHId:   evaluation.profilRHId,
        objectif:     String(objectif).trim(),
        actionPrevue: actionPrevue ?? null,
        echeance:     echeance ? new Date(echeance) : null,
        notes:        notes ?? null,
      },
    });

    await prisma.auditLog.create({
      data: { userId: parseInt(session.user.id), action: "CREATE", entite: "ActionDeveloppement", entiteId: action.id,
        details: `Action PDI ajoutée pour l'évaluation #${id}` },
    });

    return NextResponse.json({ data: action }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/evaluations/[id]/actions", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
