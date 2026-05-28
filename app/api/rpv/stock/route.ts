import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";
import { resolveViewAs } from "@/lib/viewAs";

/**
 * GET /api/rpv/stock
 * Stock disponible au PDV du RPV connecté.
 * Query: search, enRupture (bool), page, limit
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const viewAs  = isAdmin ? resolveViewAs(req) : null;
    const effectiveUserId = viewAs?.userId ?? parseInt(session.user.id);

    const pdv = await prisma.pointDeVente.findUnique({
      where: { rpvId: effectiveUserId },
      select: { id: true, nom: true, code: true },
    });
    if (!pdv) return NextResponse.json({ error: "Aucun PDV associé" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const page      = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit     = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip      = (page - 1) * limit;
    const search    = searchParams.get("search")   || "";
    const enRupture = searchParams.get("enRupture") === "true";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { pointDeVenteId: pdv.id };
    if (enRupture) where.quantite = 0;
    if (search)    where.produit  = { OR: [
      { nom:       { contains: search, mode: "insensitive" } },
      { reference: { contains: search, mode: "insensitive" } },
    ]};

    const [stocks, total] = await Promise.all([
      prisma.stockSite.findMany({
        where,
        skip,
        take: limit,
        orderBy: { produit: { nom: "asc" } },
        include: {
          produit: { select: { id: true, nom: true, reference: true, categorie: true, unite: true, prixUnitaire: true, prixAchat: true, alerteStock: true } },
        },
      }),
      prisma.stockSite.count({ where }),
    ]);

    // Stats du PDV (sur toutes les références, pas uniquement la page courante)
    const allStocksStats = await prisma.stockSite.findMany({
      where: { pointDeVenteId: pdv.id },
      select: { quantite: true, produit: { select: { prixUnitaire: true, prixAchat: true } } },
    });
    const enRuptureCount = allStocksStats.filter(s => s.quantite === 0).length;
    const valeurTotale   = allStocksStats.reduce((acc, s) => {
      const coutUnit = Number(s.produit.prixAchat ?? s.produit.prixUnitaire);
      return acc + s.quantite * coutUnit;
    }, 0);

    const dataWithTheorique = stocks.map(s => ({
      ...s,
      valeurStock:    s.quantite * Number(s.produit.prixAchat ?? s.produit.prixUnitaire),
      stockTheorique: s.quantite + s.quantiteReservee + s.quantiteEnTransit - s.quantiteEndommagee,
    }));

    return NextResponse.json({
      pdv,
      data:  dataWithTheorique,
      stats: { totalReferences: total, enRuptureCount, valeurTotale },
      meta:  { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /rpv/stock:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
