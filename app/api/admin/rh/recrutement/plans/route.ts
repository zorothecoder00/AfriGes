import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/rh/recrutement/plans
 * Liste les plans de recrutement annuels, avec le budget engagé calculé
 * (somme des budgetPoste des PosteOuvert rattachés).
 */
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const plans = await prisma.planRecrutementAnnuel.findMany({
      orderBy: { annee: "desc" },
      include: { postes: { select: { id: true, titre: true, budgetPoste: true, nbPostes: true, statut: true } } },
    });

    const data = plans.map((p) => ({
      ...p,
      budgetEngage: p.postes.reduce((s, poste) => s + Number(poste.budgetPoste ?? 0), 0),
      effectifPrevu: p.postes.reduce((s, poste) => s + poste.nbPostes, 0),
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/admin/rh/recrutement/plans", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/recrutement/plans
 * Body: { annee, budgetTotal?, effectifCible?, notes? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { annee, budgetTotal, effectifCible, notes } = body;

    if (!annee) return NextResponse.json({ error: "annee est obligatoire" }, { status: 400 });

    const existing = await prisma.planRecrutementAnnuel.findUnique({ where: { annee: Number(annee) } });
    if (existing) return NextResponse.json({ error: `Un plan existe déjà pour ${annee}` }, { status: 409 });

    const plan = await prisma.planRecrutementAnnuel.create({
      data: {
        annee:         Number(annee),
        budgetTotal:   budgetTotal ? Number(budgetTotal) : null,
        effectifCible: effectifCible ? Number(effectifCible) : null,
        notes:         notes ?? null,
        createdById:   parseInt(session.user.id),
        statut:        "BROUILLON",
      },
    });

    await prisma.auditLog.create({
      data: { userId: parseInt(session.user.id), action: "CREATE", entite: "PlanRecrutementAnnuel", entiteId: plan.id,
        details: `Plan de recrutement ${annee} créé` },
    });

    return NextResponse.json({ data: plan }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/recrutement/plans", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
