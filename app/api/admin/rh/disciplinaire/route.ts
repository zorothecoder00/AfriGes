import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { TypeSanction, StatutProcedure } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const profilRHId = searchParams.get("profilRHId");
    const statut     = searchParams.get("statut") as StatutProcedure | null;
    const search     = searchParams.get("search")?.trim() ?? "";
    const page       = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit      = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip       = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (profilRHId) where.profilRHId = Number(profilRHId);
    if (statut)     where.statut     = statut;
    if (search) {
      where.OR = [
        { motif: { contains: search, mode: "insensitive" } },
        { profilRH: { gestionnaire: { member: { OR: [
          { nom:    { contains: search, mode: "insensitive" } },
          { prenom: { contains: search, mode: "insensitive" } },
        ]}}}},
      ];
    }

    const [procedures, total, stats] = await Promise.all([
      prisma.procedureDisciplinaire.findMany({
        where, skip, take: limit,
        orderBy: { dateProcedure: "desc" },
        include: {
          profilRH: {
            select: {
              id: true, matricule: true,
              gestionnaire: { select: { member: { select: { id: true, nom: true, prenom: true, photo: true } } } },
            },
          },
        },
      }),
      prisma.procedureDisciplinaire.count({ where }),
      prisma.procedureDisciplinaire.groupBy({ by: ["statut"], _count: { id: true } }),
    ]);

    const statsMap = Object.fromEntries(stats.map((s) => [s.statut, s._count.id]));
    return NextResponse.json({ data: procedures, meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, stats: statsMap });
  } catch (error) {
    console.error("GET /api/admin/rh/disciplinaire", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { profilRHId, type, motif, faitsReproches, dateIncident, dateConvocation, dureeSuspension, notes } = body;

    if (!profilRHId || !type || !motif || !dateIncident) {
      return NextResponse.json({ error: "profilRHId, type, motif et dateIncident sont obligatoires" }, { status: 400 });
    }

    const procedure = await prisma.procedureDisciplinaire.create({
      data: {
        profilRHId:     Number(profilRHId),
        type:           type as TypeSanction,
        motif,
        faitsReproches: faitsReproches  ?? null,
        dateIncident:   new Date(dateIncident),
        dateConvocation:dateConvocation ? new Date(dateConvocation) : null,
        dureeSuspension:dureeSuspension ? Number(dureeSuspension) : null,
        notes:          notes           ?? null,
        traiteParId:    parseInt(session.user.id),
        statut:         "OUVERTE",
      },
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
      data: { userId: parseInt(session.user.id), action: "CREATE", entite: "ProcedureDisciplinaire", entiteId: procedure.id, details: `Procédure ${type} ouverte pour profilRH #${profilRHId}` },
    });

    return NextResponse.json({ data: procedure }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/disciplinaire", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
