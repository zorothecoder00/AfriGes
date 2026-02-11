import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

/**
 * GET /api/admin/ventes
 * Liste toutes les ventes via credit alimentaire avec pagination et stats
 */
export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !session.user.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 10)));
    const skip = (page - 1) * limit;
    const search = searchParams.get("search") || "";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { produit: { nom: { contains: search, mode: "insensitive" } } },
        {
          creditAlimentaire: {
            member: {
              OR: [
                { nom: { contains: search, mode: "insensitive" } },
                { prenom: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    const [ventes, total] = await Promise.all([
      prisma.venteCreditAlimentaire.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          produit: {
            select: { id: true, nom: true, prixUnitaire: true },
          },
          creditAlimentaire: {
            select: {
              id: true,
              member: {
                select: { id: true, nom: true, prenom: true, email: true },
              },
            },
          },
        },
      }),
      prisma.venteCreditAlimentaire.count({ where }),
    ]);

    // Statistiques globales
    const agg = await prisma.venteCreditAlimentaire.aggregate({
      _count: { id: true },
      _sum: { prixUnitaire: true },
    });

    // Nombre de clients distincts (beneficiaires actifs)
    const distinctCredits = await prisma.venteCreditAlimentaire.findMany({
      select: { creditAlimentaireId: true },
      distinct: ["creditAlimentaireId"],
    });

    return NextResponse.json({
      data: ventes,
      stats: {
        totalVentes: agg._count.id ?? 0,
        montantTotal: agg._sum.prixUnitaire ?? 0,
        clientsActifs: distinctCredits.length,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /admin/ventes error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recuperation des ventes" },
      { status: 500 }
    );
  }
}
