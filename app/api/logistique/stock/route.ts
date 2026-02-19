import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLogistiqueSession } from "@/lib/authLogistique";

/**
 * GET /api/logistique/stock
 * Liste tous les produits avec état du stock, stats et pagination.
 */
export async function GET(req: Request) {
  try {
    const session = await getLogistiqueSession();
    if (!session) return NextResponse.json({ error: "Acces refuse" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 15)));
    const skip  = (page - 1) * limit;
    const search = searchParams.get("search") || "";

    const where: Prisma.ProduitWhereInput = search
      ? {
          OR: [
            { nom:         { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    const [produits, total, allForStats] = await Promise.all([
      prisma.produit.findMany({ where, skip, take: limit, orderBy: { nom: "asc" } }),
      prisma.produit.count({ where }),
      prisma.produit.findMany({ select: { stock: true, alerteStock: true, prixUnitaire: true } }),
    ]);

    const totalProduits = allForStats.length;
    const enRupture     = allForStats.filter(p => p.stock === 0).length;
    const stockFaible   = allForStats.filter(p => p.stock > 0 && p.stock <= p.alerteStock).length;
    const valeurTotale  = allForStats.reduce((acc, p) => acc + Number(p.prixUnitaire) * p.stock, 0);

    return NextResponse.json({
      data:  produits,
      stats: { totalProduits, enRupture, stockFaible, valeurTotale },
      meta:  { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /logistique/stock error:", error);
    return NextResponse.json({ error: "Erreur lors du chargement du stock" }, { status: 500 });
  }
}
