import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutRemboursementFrais, TypeRemboursementFrais } from "@prisma/client";

/**
 * GET /api/admin/rh/remboursements-frais
 * Query: profilRHId, statut, type, page, limit
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const profilRHId = searchParams.get("profilRHId");
    const statut     = searchParams.get("statut") as StatutRemboursementFrais | null;
    const type       = searchParams.get("type")   as TypeRemboursementFrais   | null;
    const search     = searchParams.get("search")?.trim() ?? "";
    const page       = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit      = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip       = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (profilRHId) where.profilRHId = Number(profilRHId);
    if (statut)     where.statut     = statut;
    if (type)       where.type       = type;
    if (search) {
      where.OR = [
        { libelle: { contains: search, mode: "insensitive" } },
        { profilRH: { gestionnaire: { member: { OR: [
          { nom:    { contains: search, mode: "insensitive" } },
          { prenom: { contains: search, mode: "insensitive" } },
        ]}}}},
      ];
    }

    const [remboursements, total, stats] = await Promise.all([
      prisma.remboursementFrais.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dateFrais: "desc" },
        include: {
          profilRH: {
            select: {
              id: true, matricule: true,
              gestionnaire: { select: { member: { select: { id: true, nom: true, prenom: true, photo: true } } } },
            },
          },
        },
      }),
      prisma.remboursementFrais.count({ where }),
      prisma.remboursementFrais.groupBy({ by: ["statut"], _count: { id: true } }),
    ]);

    const statsMap = Object.fromEntries(stats.map((s) => [s.statut, s._count.id]));
    return NextResponse.json({
      data: remboursements,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: statsMap,
    });
  } catch (error) {
    console.error("GET /api/admin/rh/remboursements-frais", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/remboursements-frais
 * Body: { profilRHId, type, libelle, montant, dateFrais, justificatif?, notes? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { profilRHId, type, libelle, montant, dateFrais, justificatif, notes } = body;

    if (!profilRHId || !type || !libelle || !montant || !dateFrais) {
      return NextResponse.json({ error: "profilRHId, type, libelle, montant et dateFrais sont obligatoires" }, { status: 400 });
    }

    const remb = await prisma.remboursementFrais.create({
      data: {
        profilRHId:   Number(profilRHId),
        type:         type as TypeRemboursementFrais,
        libelle,
        montant:      Number(montant),
        dateFrais:    new Date(dateFrais),
        justificatif: justificatif ?? null,
        notes:        notes        ?? null,
        statut:       "EN_ATTENTE",
      },
    });

    await prisma.auditLog.create({
      data: { userId: parseInt(session.user.id), action: "CREATE", entite: "RemboursementFrais", entiteId: remb.id, details: `Remboursement ${type} créé pour profilRH #${profilRHId}` },
    });

    return NextResponse.json({ data: remb }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/remboursements-frais", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
