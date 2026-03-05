import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLogistiqueSession } from "@/lib/authLogistique";
import { getAuthSession } from "@/lib/auth";

async function getSession() {
  const logistique = await getLogistiqueSession();
  if (logistique) return logistique;
  const s = await getAuthSession();
  if (s && (s.user.role === "ADMIN" || s.user.role === "SUPER_ADMIN")) return s;
  return null;
}

/**
 * GET /api/logistique/stock
 * Vue stock par PDV pour l'agent logistique.
 * Query: pdvId, search, enRupture (bool), page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page      = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit     = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip      = (page - 1) * limit;
    const search    = searchParams.get("search")   || "";
    const pdvId     = searchParams.get("pdvId");
    const enRupture = searchParams.get("enRupture") === "true";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { produit: { actif: true } };
    if (pdvId)     where.pointDeVenteId = Number(pdvId);
    if (enRupture) where.quantite = 0;
    if (search)    where.produit = { ...where.produit, OR: [
      { nom:       { contains: search, mode: "insensitive" } },
      { reference: { contains: search, mode: "insensitive" } },
    ]};

    const [stocks, total] = await Promise.all([
      prisma.stockSite.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ pointDeVente: { nom: "asc" } }, { produit: { nom: "asc" } }],
        include: {
          produit:      { select: { id: true, nom: true, reference: true, categorie: true, unite: true, prixUnitaire: true, alerteStock: true } },
          pointDeVente: { select: { id: true, nom: true, code: true, type: true } },
        },
      }),
      prisma.stockSite.count({ where }),
    ]);

    // Stats globales
    const allStocks = await prisma.stockSite.findMany({
      select: { quantite: true, alerteStock: true, produit: { select: { prixUnitaire: true, alerteStock: true } } },
    });
    const enRuptureCount = allStocks.filter(s => s.quantite === 0).length;
    const faibleCount    = allStocks.filter(s => {
      const seuil = s.alerteStock ?? s.produit.alerteStock;
      return s.quantite > 0 && s.quantite <= seuil;
    }).length;
    const valeurTotale   = allStocks.reduce((acc, s) => acc + s.quantite * Number(s.produit.prixUnitaire), 0);
    const totalSites     = allStocks.length;

    // Liste des PDV pour filtre
    const pdvs = await prisma.pointDeVente.findMany({
      where: { actif: true },
      select: { id: true, nom: true, code: true, type: true },
      orderBy: { nom: "asc" },
    });

    return NextResponse.json({
      data:  stocks,
      pdvs,
      stats: { totalSites, enRuptureCount, faibleCount, valeurTotale },
      meta:  { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /logistique/stock:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
