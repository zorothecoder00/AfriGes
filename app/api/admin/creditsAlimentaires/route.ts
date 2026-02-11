import { NextResponse } from "next/server";
import { Prisma, StatutCreditAlim } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

/**
 * GET /api/admin/creditsAlimentaires
 * Liste tous les credits alimentaires avec pagination, recherche et stats
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
    const statutParam = searchParams.get("statut");

    const statut =
      statutParam && Object.values(StatutCreditAlim).includes(statutParam as StatutCreditAlim)
        ? (statutParam as StatutCreditAlim)
        : undefined;

    const where: Prisma.CreditAlimentaireWhereInput = {
      ...(statut && { statut }),
      ...(search && {
        member: {
          OR: [
            { nom: { contains: search, mode: "insensitive" } },
            { prenom: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        },
      }),
    };

    const [credits, total] = await Promise.all([
      prisma.creditAlimentaire.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          member: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              email: true,
            },
          },
        },
      }),
      prisma.creditAlimentaire.count({ where }),
    ]);

    // Statistiques
    const [totalActifs, totalEpuises, totalExpires, sumPlafond, sumUtilise] = await Promise.all([
      prisma.creditAlimentaire.count({ where: { statut: StatutCreditAlim.ACTIF } }),
      prisma.creditAlimentaire.count({ where: { statut: StatutCreditAlim.EPUISE } }),
      prisma.creditAlimentaire.count({ where: { statut: StatutCreditAlim.EXPIRE } }),
      prisma.creditAlimentaire.aggregate({
        _sum: { plafond: true },
      }),
      prisma.creditAlimentaire.aggregate({
        where: { statut: StatutCreditAlim.ACTIF },
        _sum: { montantUtilise: true, montantRestant: true },
      }),
    ]);

    return NextResponse.json({
      data: credits,
      stats: {
        totalActifs,
        totalEpuises,
        totalExpires,
        montantTotalPlafond: sumPlafond._sum.plafond ?? 0,
        montantTotalUtilise: sumUtilise._sum.montantUtilise ?? 0,
        montantTotalRestant: sumUtilise._sum.montantRestant ?? 0,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /admin/creditsAlimentaires error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recuperation des credits alimentaires" },
      { status: 500 }
    );
  }
}
