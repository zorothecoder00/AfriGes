import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/rh/planning
 * Liste les plannings d'équipe hebdomadaires.
 * Query: annee? (filtre sur l'année de semaineDebut), page?, limit?
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const annee = searchParams.get("annee");
    const page  = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip  = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (annee) {
      const y = Number(annee);
      where.semaineDebut = { gte: new Date(`${y}-01-01`), lt: new Date(`${y + 1}-01-01`) };
    }

    const [plannings, total] = await Promise.all([
      prisma.planningEquipe.findMany({
        where, skip, take: limit,
        orderBy: { semaineDebut: "desc" },
        include: { _count: { select: { affectations: true } } },
      }),
      prisma.planningEquipe.count({ where }),
    ]);

    return NextResponse.json({ data: plannings, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error("GET /api/admin/rh/planning", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/planning
 * Body: { semaineDebut, notes? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { semaineDebut, notes } = body;

    if (!semaineDebut) return NextResponse.json({ error: "semaineDebut est obligatoire" }, { status: 400 });

    const planning = await prisma.planningEquipe.create({
      data: {
        semaineDebut: new Date(semaineDebut),
        responsableId: parseInt(session.user.id),
        notes: notes ?? null,
        statut: "BROUILLON",
      },
    });

    await prisma.auditLog.create({
      data: { userId: parseInt(session.user.id), action: "CREATE", entite: "PlanningEquipe", entiteId: planning.id,
        details: `Planning d'équipe créé pour la semaine du ${semaineDebut}` },
    });

    return NextResponse.json({ data: planning }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/planning", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
