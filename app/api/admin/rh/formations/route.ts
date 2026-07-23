import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutFormation, TypeFormation } from "@prisma/client";

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
    const type       = searchParams.get("type")   as TypeFormation   | null;
    const annee      = searchParams.get("annee");
    const search     = searchParams.get("search")?.trim() ?? "";
    const profilRHId = searchParams.get("profilRHId");
    const page       = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit      = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip       = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut)     where.statut = statut;
    if (type)       where.type   = type;
    if (profilRHId) where.participations = { some: { profilRHId: Number(profilRHId) } };
    if (annee) {
      const y = Number(annee);
      where.dateDebut = { gte: new Date(`${y}-01-01`), lt: new Date(`${y + 1}-01-01`) };
    }
    if (search) where.OR = [
      { titre:     { contains: search, mode: "insensitive" } },
      { formateur: { contains: search, mode: "insensitive" } },
      { lieu:      { contains: search, mode: "insensitive" } },
    ];

    const [formations, total, stats, statsByType] = await Promise.all([
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
      prisma.formation.groupBy({ by: ["type"],   _count: { id: true } }),
    ]);

    const statsMap     = Object.fromEntries(stats.map((s) => [s.statut, s._count.id]));
    const statsTypeMap = Object.fromEntries(statsByType.map((s) => [String(s.type), s._count.id]));
    return NextResponse.json({
      data: formations,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: statsMap,
      statsByType: statsTypeMap,
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
    const { titre, type, objectifs, lieu, formateur, dateDebut, dateFin, dureeHeures, cout, budgetAlloue, certificationNom, notes, participantIds = [], planFormationId } = body;

    if (!titre || !dateDebut) {
      return NextResponse.json({ error: "titre et dateDebut sont obligatoires" }, { status: 400 });
    }

    const formation = await prisma.formation.create({
      data: {
        titre,
        type:            type            ? type as TypeFormation : null,
        objectifs:       objectifs       ?? null,
        lieu:            lieu            ?? null,
        formateur:       formateur       ?? null,
        dateDebut:       new Date(dateDebut),
        dateFin:         dateFin         ? new Date(dateFin) : null,
        dureeHeures:     dureeHeures     ? Number(dureeHeures)  : null,
        cout:            cout            ? Number(cout)         : null,
        budgetAlloue:    budgetAlloue    ? Number(budgetAlloue) : null,
        certificationNom:certificationNom?? null,
        notes:           notes           ?? null,
        createdById:     parseInt(session.user.id),
        planFormationId: planFormationId ? Number(planFormationId) : null,
        statut:          "PLANIFIEE",
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
