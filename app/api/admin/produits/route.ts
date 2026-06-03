import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/produits
 * Recherche de produits (catalogue complet).
 * Query: search, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();
    const limit  = Math.min(20, Math.max(1, Number(searchParams.get("limit") || 10)));

    const where: Prisma.ProduitWhereInput = {
      actif: true,
      ...(search && {
        OR: [
          { nom:         { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { reference:   { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const produits = await prisma.produit.findMany({
      where,
      take: limit,
      orderBy: { nom: "asc" },
      select: {
        id:          true,
        nom:         true,
        unite:       true,
        prixUnitaire: true,
        reference:   true,
      },
    });

    return NextResponse.json({
      success: true,
      data: produits.map(p => ({ ...p, prixUnitaire: Number(p.prixUnitaire) })),
    });
  } catch (error) {
    console.error("GET /api/admin/produits", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
