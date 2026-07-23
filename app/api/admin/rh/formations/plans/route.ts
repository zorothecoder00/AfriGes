import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/rh/formations/plans
 * Liste les plans de formation annuels, avec le budget engagé calculé
 * (somme des budgetAlloue des Formation rattachées).
 */
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const plans = await prisma.planFormationAnnuel.findMany({
      orderBy: { annee: "desc" },
      include: { formations: { select: { id: true, titre: true, budgetAlloue: true, cout: true, statut: true } } },
    });

    const data = plans.map((p) => ({
      ...p,
      budgetEngage: p.formations.reduce((s, f) => s + Number(f.budgetAlloue ?? 0), 0),
      coutReel:     p.formations.reduce((s, f) => s + Number(f.cout ?? 0), 0),
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/admin/rh/formations/plans", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/formations/plans
 * Body: { annee, budgetTotal?, axesPrioritaires?, notes? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { annee, budgetTotal, axesPrioritaires, notes } = body;

    if (!annee) return NextResponse.json({ error: "annee est obligatoire" }, { status: 400 });

    const existing = await prisma.planFormationAnnuel.findUnique({ where: { annee: Number(annee) } });
    if (existing) return NextResponse.json({ error: `Un plan existe déjà pour ${annee}` }, { status: 409 });

    const plan = await prisma.planFormationAnnuel.create({
      data: {
        annee:            Number(annee),
        budgetTotal:      budgetTotal ? Number(budgetTotal) : null,
        axesPrioritaires: axesPrioritaires ?? null,
        notes:            notes ?? null,
        createdById:      parseInt(session.user.id),
        statut:           "BROUILLON",
      },
    });

    await prisma.auditLog.create({
      data: { userId: parseInt(session.user.id), action: "CREATE", entite: "PlanFormationAnnuel", entiteId: plan.id,
        details: `Plan de formation ${annee} créé` },
    });

    return NextResponse.json({ data: plan }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/formations/plans", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
