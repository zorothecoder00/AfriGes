import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";
import { resoudrePrixBatch } from "@/lib/tarificationBatch";

/**
 * GET /api/rpv/produits
 * Liste les produits avec pagination, recherche et filtre de statut stock.
 * Paramètres : page, limit, search, statut (EN_STOCK|STOCK_FAIBLE|RUPTURE)
 */
export async function GET(req: Request) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);

    // PDV du RPV — stock filtré sur ce PDV uniquement
    const pdv = await prisma.pointDeVente.findUnique({ where: { rpvId: userId } });
    if (!pdv) return NextResponse.json({ message: "Aucun PDV associé" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit  = Math.min(50, Math.max(5, Number(searchParams.get("limit") ?? "15")));
    const search = ( searchParams.get("search") ?? "" ).trim();
    const statut = searchParams.get("statut") ?? "";

    // Filtrer uniquement les produits qui ont un StockSite sur ce PDV
    // (le POST crée toujours un StockSite dès la création, même à 0)
    const where: Prisma.ProduitWhereInput = {
      stocks: { some: { pointDeVenteId: pdv.id } },
    };
    if (search) {
      where.AND = [
        { stocks: { some: { pointDeVenteId: pdv.id } } },
        { OR: [
          { nom:         { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { reference:   { contains: search, mode: "insensitive" } },
          { codeBarre:   { contains: search } }, // scan douchette au comptoir (§11)
          { qrCode:      { contains: search } },
        ]},
      ];
      delete where.stocks;
    }

    // Stock filtré sur le PDV du RPV (pas le stock global)
    const allProduits = await prisma.produit.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        stocks: {
          where: { pointDeVenteId: pdv.id },
          select: { quantite: true, quantiteReservee: true, quantiteEnTransit: true, quantiteEndommagee: true },
        },
      },
    });

    // totalStock = stock disponible de CE PDV uniquement
    const produitsAvecStock = allProduits.map((p) => {
      const s = p.stocks[0];
      return {
        ...p,
        totalStock:         s?.quantite          ?? 0,
        quantiteReservee:   s?.quantiteReservee   ?? 0,
        quantiteEnTransit:  s?.quantiteEnTransit  ?? 0,
        quantiteEndommagee: s?.quantiteEndommagee ?? 0,
        stockTheorique:     (s?.quantite ?? 0) + (s?.quantiteReservee ?? 0) + (s?.quantiteEnTransit ?? 0) - (s?.quantiteEndommagee ?? 0),
      };
    });

    // Filtres de statut en mémoire
    let filtered = produitsAvecStock;
    if (statut === "EN_STOCK")     filtered = produitsAvecStock.filter((p) => p.totalStock > p.alerteStock);
    if (statut === "RUPTURE")      filtered = produitsAvecStock.filter((p) => p.totalStock === 0);
    if (statut === "STOCK_FAIBLE") filtered = produitsAvecStock.filter((p) => p.totalStock > 0 && p.totalStock <= p.alerteStock);

    const total     = filtered.length;
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    // Statistiques globales
    const enRupture    = produitsAvecStock.filter((p) => p.totalStock === 0).length;
    const stockFaible  = produitsAvecStock.filter((p) => p.totalStock > 0 && p.totalStock <= p.alerteStock).length;
    const valeurTotale = produitsAvecStock.reduce((s, p) => s + Number(p.prixAchat ?? p.prixUnitaire) * p.totalStock, 0);

    // Prix DETAIL résolu par agence (§8) sur la page courante — pour l'affichage vente comptant.
    const pageItems = paginated.map(({ stocks: _stocks, totalStock, ...p }) => ({ ...p, stock: totalStock, prixUnitaire: Number(p.prixUnitaire) }));
    const prixMap = await resoudrePrixBatch(pageItems.map((p) => p.id), ["DETAIL"], { pointDeVenteId: pdv.id });

    return NextResponse.json({
      success: true,
      data: pageItems.map((p) => ({ ...p, prixDetail: prixMap.get(p.id)?.DETAIL ?? p.prixUnitaire })),
      stats: {
        totalProduits: produitsAvecStock.length,
        enRupture,
        stockFaible,
        valeurTotale,
      },
      meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    console.error("GET /api/rpv/produits error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}

/** POST /api/rpv/produits — Interdit : réservé à Admin / Logistique */
export async function POST() {
  return NextResponse.json(
    { message: "La création de produits est réservée à l'Admin et au Responsable Approvisionnement" },
    { status: 403 }
  );
}
