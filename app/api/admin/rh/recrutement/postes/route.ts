import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutPoste, TypeContrat } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut") as StatutPoste | null;
    const search = searchParams.get("search")?.trim() ?? "";
    const page   = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit  = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip   = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut) where.statut = statut;
    if (search) where.OR = [
      { titre:       { contains: search, mode: "insensitive" } },
      { departement: { contains: search, mode: "insensitive" } },
      { service:     { contains: search, mode: "insensitive" } },
    ];

    const [postes, total, stats] = await Promise.all([
      prisma.posteOuvert.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { candidatures: true } },
          candidatures: { select: { statut: true } },
        },
      }),
      prisma.posteOuvert.count({ where }),
      prisma.posteOuvert.groupBy({ by: ["statut"], _count: { id: true } }),
    ]);

    const statsMap = Object.fromEntries(stats.map((s) => [s.statut, s._count.id]));
    return NextResponse.json({ data: postes, meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, stats: statsMap });
  } catch (error) {
    console.error("GET /api/admin/rh/recrutement/postes", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { titre, departement, service, typeContrat, description, competencesRequises, experienceMin, dateLimite, notes } = body;

    if (!titre) return NextResponse.json({ error: "titre est obligatoire" }, { status: 400 });

    const poste = await prisma.posteOuvert.create({
      data: {
        titre,
        departement:         departement         ?? null,
        service:             service             ?? null,
        typeContrat:         typeContrat         ? (typeContrat as TypeContrat) : null,
        description:         description         ?? null,
        competencesRequises: competencesRequises ?? null,
        experienceMin:       experienceMin       ? Number(experienceMin) : null,
        dateLimite:          dateLimite          ? new Date(dateLimite) : null,
        notes:               notes               ?? null,
        createdById:         parseInt(session.user.id),
        statut:              "OUVERT",
      },
    });

    await prisma.auditLog.create({ data: { userId: parseInt(session.user.id), action: "CREATE", entite: "PosteOuvert", entiteId: poste.id, details: `Poste "${titre}" créé` } });
    return NextResponse.json({ data: poste }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/recrutement/postes", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
