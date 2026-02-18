import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";

/**
 * GET /api/magasinier/mouvements
 * Journal de tous les mouvements de stock (cross-produit)
 */
export async function GET(req: Request) {
  try {
    const session = await getMagasinierSession();
    if (!session) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip = (page - 1) * limit;
    const typeParam = searchParams.get("type");
    const produitId = searchParams.get("produitId");
    const search = searchParams.get("search") || "";

    const where: Prisma.MouvementStockWhereInput = {
      ...(typeParam && { type: typeParam as "ENTREE" | "SORTIE" | "AJUSTEMENT" }),
      ...(produitId && { produitId: Number(produitId) }),
      ...(search && {
        OR: [
          { motif: { contains: search, mode: "insensitive" } },
          { reference: { contains: search, mode: "insensitive" } },
          { produit: { nom: { contains: search, mode: "insensitive" } } },
        ],
      }),
    };

    const [mouvements, total] = await Promise.all([
      prisma.mouvementStock.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dateMouvement: "desc" },
        include: {
          produit: { select: { id: true, nom: true, stock: true, prixUnitaire: true } },
        },
      }),
      prisma.mouvementStock.count({ where }),
    ]);

    // Stats des 30 derniers jours
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalEntrees, totalSorties, totalAjustements] = await Promise.all([
      prisma.mouvementStock.count({
        where: { type: "ENTREE", dateMouvement: { gte: thirtyDaysAgo } },
      }),
      prisma.mouvementStock.count({
        where: { type: "SORTIE", dateMouvement: { gte: thirtyDaysAgo } },
      }),
      prisma.mouvementStock.count({
        where: { type: "AJUSTEMENT", dateMouvement: { gte: thirtyDaysAgo } },
      }),
    ]);

    return NextResponse.json({
      data: mouvements,
      stats: { totalEntrees, totalSorties, totalAjustements },
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /magasinier/mouvements error:", error);
    return NextResponse.json({ error: "Erreur lors du chargement" }, { status: 500 });
  }
}
