import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { randomUUID } from "crypto";

/**
 * GET /api/admin/stock
 * Liste tous les produits avec pagination, recherche et stats
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

    const where: Prisma.ProduitWhereInput = {
      ...(search && {
        OR: [
          { nom: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [produits, total] = await Promise.all([
      prisma.produit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.produit.count({ where }),
    ]);

    // Statistiques stock
    const allProduits = await prisma.produit.findMany({
      select: { stock: true, alerteStock: true, prixUnitaire: true },
    });

    const totalProduits = allProduits.length;
    const enRupture = allProduits.filter((p) => p.stock === 0).length;
    const stockFaible = allProduits.filter((p) => p.stock > 0 && p.stock <= p.alerteStock).length;
    const valeurTotale = allProduits.reduce(
      (sum, p) => sum + p.stock * Number(p.prixUnitaire),
      0
    );

    return NextResponse.json({
      data: produits,
      stats: {
        totalProduits,
        enRupture,
        stockFaible,
        valeurTotale,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /admin/stock error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recuperation du stock" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/stock
 * Creer un nouveau produit avec mouvement initial
 */
export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !session.user.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const body = await req.json();
    const { nom, description, prixUnitaire, stock, alerteStock } = body;

    if (!nom || prixUnitaire === undefined || prixUnitaire === null) {
      return NextResponse.json(
        { error: "Nom et prix unitaire sont obligatoires" },
        { status: 400 }
      );
    }

    if (Number(prixUnitaire) <= 0) {
      return NextResponse.json(
        { error: "Le prix unitaire doit etre superieur a 0" },
        { status: 400 }
      );
    }

    const produit = await prisma.$transaction(async (tx) => {
      const created = await tx.produit.create({
        data: {
          nom,
          description: description || null,
          prixUnitaire: new Prisma.Decimal(prixUnitaire),
          stock: Number(stock) || 0,
          alerteStock: Number(alerteStock) || 0,
        },
      });

      // Mouvement d'entree initial si stock > 0
      if (created.stock > 0) {
        await tx.mouvementStock.create({
          data: {
            produitId: created.id,
            type: "ENTREE",
            quantite: created.stock,
            motif: "Stock initial",
            reference: `INIT-${randomUUID()}`,
          },
        });
      }

      return created;
    });

    return NextResponse.json({ data: produit }, { status: 201 });
  } catch (error) {
    console.error("POST /admin/stock error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la creation du produit" },
      { status: 500 }
    );
  }
}
