import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCaissierSession, getCaissierPdvId } from "@/lib/authCaissier";
import { resoudrePrixBatch } from "@/lib/tarificationBatch";

/**
 * GET /api/caissier/produits
 * Recherche de produits en stock sur le PDV du caissier.
 * Query: search, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId   = isAdmin ? null : await getCaissierPdvId(userId);

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();
    const limit  = Math.min(20, Math.max(1, Number(searchParams.get("limit") || 10)));

    const searchConditions: Prisma.ProduitWhereInput = search
      ? {
          OR: [
            { nom:         { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { reference:   { contains: search, mode: "insensitive" } },
            { codeBarre:   { contains: search } }, // scan douchette au comptoir (§11)
            { qrCode:      { contains: search } },
          ],
        }
      : {};

    const where: Prisma.ProduitWhereInput = {
      actif: true,
      ...(pdvId ? { stocks: { some: { pointDeVenteId: pdvId } } } : {}),
      ...searchConditions,
    };

    const produits = await prisma.produit.findMany({
      where,
      take: limit,
      orderBy: { nom: "asc" },
      select: {
        id:           true,
        nom:          true,
        unite:        true,
        prixUnitaire: true,
        reference:    true,
      },
    });

    // Prix DETAIL résolu par agence (§8) pour l'affichage vente comptant / pro-forma.
    const prixMap = await resoudrePrixBatch(produits.map(p => p.id), ["DETAIL"], { pointDeVenteId: pdvId });
    return NextResponse.json({
      success: true,
      data: produits.map(p => {
        const pu = Number(p.prixUnitaire);
        return { ...p, prixUnitaire: pu, prixDetail: prixMap.get(p.id)?.DETAIL ?? pu };
      }),
    });
  } catch (error) {
    console.error("GET /api/caissier/produits", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
