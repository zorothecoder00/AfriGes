import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";

/**
 * GET /api/magasinier/mouvements
 * Journal des mouvements de stock du PDV du magasinier connecté.
 * Query: type, produitId, search, page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getMagasinierSession();
    if (!session) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Résoudre le PDV du magasinier
    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: parseInt(session.user.id), actif: true },
      select: { pointDeVenteId: true },
    });
    const pdvId = aff?.pointDeVenteId;
    if (!pdvId) {
      return NextResponse.json({ error: "Aucun point de vente associé à ce magasinier" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const page      = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit     = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip      = (page - 1) * limit;
    const typeParam = searchParams.get("type");
    const produitId = searchParams.get("produitId");
    const search    = searchParams.get("search") || "";

    const where: Prisma.MouvementStockWhereInput = {
      pointDeVenteId: pdvId,
      ...(typeParam && { type: typeParam as "ENTREE" | "SORTIE" | "AJUSTEMENT" }),
      ...(produitId && { produitId: Number(produitId) }),
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
        include: {
          produit:   { select: { id: true, nom: true, reference: true, prixUnitaire: true } },
          operateur: { select: { id: true, nom: true, prenom: true } },
        },
      }),
      prisma.mouvementStock.count({ where }),
    ]);

    // Stats des 30 derniers jours (filtrées sur le même PDV)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const pdvFilter = { pointDeVenteId: pdvId, dateMouvement: { gte: thirtyDaysAgo } };

    const [totalEntrees, totalSorties, totalAjustements] = await Promise.all([
      prisma.mouvementStock.count({ where: { ...pdvFilter, type: "ENTREE"      } }),
      prisma.mouvementStock.count({ where: { ...pdvFilter, type: "SORTIE"      } }),
      prisma.mouvementStock.count({ where: { ...pdvFilter, type: "AJUSTEMENT"  } }),
    ]);

    return NextResponse.json({
      data:  mouvements,
      stats: { totalEntrees, totalSorties, totalAjustements },
      meta:  { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /magasinier/mouvements error:", error);
    return NextResponse.json({ error: "Erreur lors du chargement" }, { status: 500 });
  }
}
