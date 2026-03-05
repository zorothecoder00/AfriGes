import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";

/**
 * GET /api/rpv/stock
 * Stock disponible au PDV du RPV connecté.
 * Query: search, enRupture (bool), page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const pdv = await prisma.pointDeVente.findUnique({
      where: { rpvId: parseInt(session.user.id) },
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
          produit: { select: { id: true, nom: true, reference: true, categorie: true, unite: true, prixUnitaire: true, alerteStock: true } },
        },
      }),
      prisma.stockSite.count({ where }),
    ]);

    // Stats du PDV
    const allStocks = await prisma.stockSite.findMany({ where: { pointDeVenteId: pdv.id } });
    const enRuptureCount = allStocks.filter(s => s.quantite === 0).length;
    const valeurTotale   = stocks.reduce((acc, s) => acc + s.quantite * Number(s.produit.prixUnitaire), 0);

    return NextResponse.json({
      pdv,
      data:  stocks,
      stats: { totalReferences: total, enRuptureCount, valeurTotale },
      meta:  { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /rpv/stock:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
