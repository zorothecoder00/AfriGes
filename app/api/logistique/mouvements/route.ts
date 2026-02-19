import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLogistiqueSession } from "@/lib/authLogistique";

/**
 * GET /api/logistique/mouvements
 * Journal complet de tous les mouvements de stock (ENTREE, SORTIE, AJUSTEMENT).
 * Utilisé pour l'onglet suivi des livraisons et journal d'audit.
 */
export async function GET(req: Request) {
  try {
    const session = await getLogistiqueSession();
    if (!session) return NextResponse.json({ error: "Acces refuse" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page      = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit     = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip      = (page - 1) * limit;
    const search    = searchParams.get("search") || "";
    const typeParam = searchParams.get("type");
    const produitId = searchParams.get("produitId");

    const where: Prisma.MouvementStockWhereInput = {
      ...(typeParam && ["ENTREE", "SORTIE", "AJUSTEMENT"].includes(typeParam) && {
        type: typeParam as "ENTREE" | "SORTIE" | "AJUSTEMENT",
      }),
      ...(produitId && !isNaN(Number(produitId)) && { produitId: Number(produitId) }),
      ...(search && {
        OR: [
          { motif:     { contains: search, mode: "insensitive" } },
          { reference: { contains: search, mode: "insensitive" } },
          { produit:   { nom: { contains: search, mode: "insensitive" } } },
        ],
      }),
    };

    const [mouvements, total] = await Promise.all([
      prisma.mouvementStock.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dateMouvement: "desc" },
        include: { produit: { select: { id: true, nom: true, stock: true } } },
      }),
      prisma.mouvementStock.count({ where }),
    ]);

    // Stats globales (30 derniers jours)
    const since30j = new Date();
    since30j.setDate(since30j.getDate() - 30);

    const [totalEntrees, totalSorties, totalAjustements] = await Promise.all([
      prisma.mouvementStock.count({ where: { type: "ENTREE",     dateMouvement: { gte: since30j } } }),
      prisma.mouvementStock.count({ where: { type: "SORTIE",     dateMouvement: { gte: since30j } } }),
      prisma.mouvementStock.count({ where: { type: "AJUSTEMENT", dateMouvement: { gte: since30j } } }),
    ]);

    return NextResponse.json({
      data:  mouvements,
      stats: { totalEntrees, totalSorties, totalAjustements },
      meta:  { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /logistique/mouvements error:", error);
    return NextResponse.json({ error: "Erreur lors du chargement du journal" }, { status: 500 });
  }
}
