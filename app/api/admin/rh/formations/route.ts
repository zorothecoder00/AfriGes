import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutFormation } from "@prisma/client";

/**
 * GET /api/admin/rh/formations
 * Query: statut, search, page, limit
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const statut     = searchParams.get("statut") as StatutFormation | null;
    const search     = searchParams.get("search")?.trim() ?? "";
    const profilRHId = searchParams.get("profilRHId");
    const page       = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit      = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip       = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut)     where.statut = statut;
    if (profilRHId) where.participations = { some: { profilRHId: Number(profilRHId) } };
    if (search) where.OR = [
      { titre:     { contains: search, mode: "insensitive" } },
      { formateur: { contains: search, mode: "insensitive" } },
      { lieu:      { contains: search, mode: "insensitive" } },
    ];

    const [formations, total, stats] = await Promise.all([
      prisma.formation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dateDebut: "desc" },
        include: {
          participations: {
            include: {
              profilRH: {
                select: {
                  id: true, matricule: true,
                  gestionnaire: { select: { member: { select: { nom: true, prenom: true, photo: true } } } },
                },
              },
            },
          },
          _count: { select: { participations: true } },
        },
      }),
      prisma.formation.count({ where }),
      prisma.formation.groupBy({ by: ["statut"], _count: { id: true } }),
    ]);

    const statsMap = Object.fromEntries(stats.map((s) => [s.statut, s._count.id]));
    return NextResponse.json({
      data: formations,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: statsMap,
    });
  } catch (error) {
    console.error("GET /api/admin/rh/formations", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/formations
 * Body: { titre, objectifs?, lieu?, formateur?, dateDebut, dateFin?, dureeHeures?, cout?, notes?, participantIds? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { titre, objectifs, lieu, formateur, dateDebut, dateFin, dureeHeures, cout, notes, participantIds = [] } = body;

    if (!titre || !dateDebut) {
      return NextResponse.json({ error: "titre et dateDebut sont obligatoires" }, { status: 400 });
    }

    const formation = await prisma.formation.create({
      data: {
        titre,
        objectifs:   objectifs   ?? null,
        lieu:        lieu        ?? null,
        formateur:   formateur   ?? null,
        dateDebut:   new Date(dateDebut),
        dateFin:     dateFin     ? new Date(dateFin) : null,
        dureeHeures: dureeHeures ? Number(dureeHeures) : null,
        cout:        cout        ? Number(cout) : null,
        notes:       notes       ?? null,
        createdById: parseInt(session.user.id),
        statut:      "PLANIFIEE",
        participations: participantIds.length > 0 ? {
          create: participantIds.map((pid: number) => ({ profilRHId: pid, statut: "INSCRIT" })),
        } : undefined,
      },
      include: { participations: true, _count: { select: { participations: true } } },
    });

    await prisma.auditLog.create({
      data: { userId: parseInt(session.user.id), action: "CREATE", entite: "Formation", entiteId: formation.id, details: `Formation "${titre}" créée` },
    });

    return NextResponse.json({ data: formation }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/formations", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
