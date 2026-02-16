import { NextResponse } from "next/server";
import { Prisma, StatutCredit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

/**
 * GET /api/admin/credits
 * Liste tous les credits (prets) avec pagination, recherche et stats
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
      statutParam && Object.values(StatutCredit).includes(statutParam as StatutCredit)
        ? (statutParam as StatutCredit)
        : undefined;

    const where: Prisma.CreditWhereInput = {
      ...(statut && { statut }),
      ...(search && {
        OR: [
          {
            client: {
              OR: [
                { nom: { contains: search, mode: "insensitive" } },
                { prenom: { contains: search, mode: "insensitive" } },
                { telephone: { contains: search, mode: "insensitive" } },
              ],
            },
          },
          {
            member: {
              OR: [
                { nom: { contains: search, mode: "insensitive" } },
                { prenom: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        ],
      }),
    };

    const [credits, total] = await Promise.all([
      prisma.credit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          client: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              telephone: true,
            },
          },
          member: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              telephone: true,
            },
          },
          transactions: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      }),
      prisma.credit.count({ where }),
    ]);

    // Statistiques
    const [totalEnAttente, totalApprouves, totalRemboursePartiel, totalRembourseTotal, totalRejetes, sumMontants] =
      await Promise.all([
        prisma.credit.count({ where: { statut: StatutCredit.EN_ATTENTE } }),
        prisma.credit.count({ where: { statut: StatutCredit.APPROUVE } }),
        prisma.credit.count({ where: { statut: StatutCredit.REMBOURSE_PARTIEL } }),
        prisma.credit.count({ where: { statut: StatutCredit.REMBOURSE_TOTAL } }),
        prisma.credit.count({ where: { statut: StatutCredit.REJETE } }),
        prisma.credit.aggregate({
          where: {
            statut: { in: [StatutCredit.APPROUVE, StatutCredit.REMBOURSE_PARTIEL] },
          },
          _sum: { montant: true, montantRestant: true },
        }),
      ]);

    return NextResponse.json({
      data: credits,
      stats: {
        totalEnAttente,
        totalApprouves,
        totalRemboursePartiel,
        totalRembourseTotal,
        totalRejetes,
        montantTotalPrete: sumMontants._sum.montant ?? 0,
        montantTotalRestant: sumMontants._sum.montantRestant ?? 0,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /admin/credits error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recuperation des credits" },
      { status: 500 }
    );
  }
}
