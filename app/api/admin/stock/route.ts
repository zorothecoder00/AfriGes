import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { auditLog } from "@/lib/notifications";
import { randomUUID } from "crypto";

async function getAdminSession() {
  const s = await getAuthSession();
  if (!s) return null;
  if (s.user.role !== "ADMIN" && s.user.role !== "SUPER_ADMIN") return null;
  return s;
}

/**
 * GET /api/admin/stock
 * Vue globale du stock (StockSite) : tous les PDV × tous les produits.
 * Query: pdvId, search, enRupture (bool), page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page      = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit     = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip      = (page - 1) * limit;
    const search    = searchParams.get("search") || "";
    const pdvId     = searchParams.get("pdvId");
    const enRupture = searchParams.get("enRupture") === "true";
    const aggregate = searchParams.get("aggregate") === "true";

    // Liste des PDV pour filtre UI (toujours retournée)
    const pdvs = await prisma.pointDeVente.findMany({
      where: { actif: true },
      select: { id: true, nom: true, code: true, type: true },
      orderBy: { nom: "asc" },
    });

    // Stats filtrées selon le contexte actif
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const produitFilter: any = { actif: true };
    if (search) produitFilter.OR = [
      { nom:       { contains: search, mode: "insensitive" } },
      { reference: { contains: search, mode: "insensitive" } },
      { categorie: { contains: search, mode: "insensitive" } },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statsWhere: any = { produit: produitFilter };
    if (!aggregate && pdvId) statsWhere.pointDeVenteId = Number(pdvId);

    const [allStocks, uniqueProduits] = await Promise.all([
      prisma.stockSite.findMany({
        where: statsWhere,
        select: { quantite: true, alerteStock: true, produit: { select: { prixUnitaire: true, alerteStock: true } } },
      }),
      prisma.stockSite.groupBy({ by: ["produitId"], where: statsWhere }),
    ]);

    const enRuptureCount = allStocks.filter(s => s.quantite === 0).length;
    const faibleCount    = allStocks.filter(s => {
      const seuil = s.alerteStock ?? s.produit.alerteStock;
      return s.quantite > 0 && s.quantite <= seuil;
    }).length;
    const valeurTotale  = allStocks.reduce((acc, s) => acc + s.quantite * Number(s.produit.prixUnitaire), 0);
    const totalProduits = aggregate
      ? await prisma.produit.count({ where: produitFilter })
      : uniqueProduits.length;

    // ── Mode "Grand stock" : vue agrégée par produit ───────────────────────
    if (aggregate) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prodWhere: any = { actif: true };
      if (search) prodWhere.OR = [
        { nom:       { contains: search, mode: "insensitive" } },
        { reference: { contains: search, mode: "insensitive" } },
        { categorie: { contains: search, mode: "insensitive" } },
      ];

      const [produits, totalProds] = await Promise.all([
        prisma.produit.findMany({
          where: prodWhere,
          skip,
          take: limit,
          orderBy: { nom: "asc" },
          include: {
            stocks: {
              select: {
                quantite: true,
                alerteStock: true,
                pointDeVente: { select: { id: true, nom: true, code: true, type: true } },
              },
            },
          },
        }),
        prisma.produit.count({ where: prodWhere }),
      ]);

      const data = produits.map(p => ({
        id: p.id, nom: p.nom, reference: p.reference, categorie: p.categorie,
        unite: p.unite, prixUnitaire: p.prixUnitaire, alerteStock: p.alerteStock,
        totalStock: p.stocks.reduce((acc, s) => acc + s.quantite, 0),
        stocks: p.stocks,
      }));

      return NextResponse.json({
        data,
        pdvs,
        stats: { totalProduits, enRuptureCount, faibleCount, valeurTotale },
        meta:  { total: totalProds, page, limit, totalPages: Math.ceil(totalProds / limit) },
      });
    }

    // ── Mode "Par PDV" : liste des StockSite ──────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { produit: { actif: true } };
    if (pdvId)     where.pointDeVenteId = Number(pdvId);
    if (enRupture) where.quantite = 0;
    if (search)    where.produit = { ...where.produit, OR: [
      { nom:       { contains: search, mode: "insensitive" } },
      { reference: { contains: search, mode: "insensitive" } },
      { categorie: { contains: search, mode: "insensitive" } },
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

    return NextResponse.json({
      data:  stocks,
      pdvs,
      stats: { totalProduits, enRuptureCount, faibleCount, valeurTotale },
      meta:  { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /admin/stock:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/stock
 * Créer un nouveau produit (sans stock initial — le stock se crée via réceptions ou affectations).
 * Body: { nom, description?, reference?, categorie?, unite?, prixUnitaire, alerteStock? }
 */
export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { nom, description, reference, categorie, unite, prixUnitaire, alerteStock } = body;

    if (!nom || prixUnitaire === undefined) {
      return NextResponse.json({ error: "nom et prixUnitaire sont obligatoires" }, { status: 400 });
    }
    if (Number(prixUnitaire) <= 0) {
      return NextResponse.json({ error: "Le prix unitaire doit être supérieur à 0" }, { status: 400 });
    }

    if (reference) {
      const existing = await prisma.produit.findUnique({ where: { reference } });
      if (existing) return NextResponse.json({ error: `La référence "${reference}" est déjà utilisée` }, { status: 409 });
    }

    const produit = await prisma.$transaction(async (tx) => {
      const p = await tx.produit.create({
        data: {
          nom,
          description:  description  || null,
          reference:    reference    || null,
          categorie:    categorie    || null,
          unite:        unite        || null,
          prixUnitaire: new Prisma.Decimal(prixUnitaire),
          alerteStock:  Number(alerteStock) || 0,
        },
      });
      await auditLog(tx, parseInt(session.user.id), "PRODUIT_CREE", "Produit", p.id);
      return p;
    });

    return NextResponse.json({ data: produit }, { status: 201 });
  } catch (error) {
    console.error("POST /admin/stock:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/stock
 * Ajustement direct de stock sur un PDV (admin seulement).
 * Body: { produitId, pointDeVenteId, quantite, motif }
 */
export async function PATCH(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { produitId, pointDeVenteId, quantite, motif } = await req.json();

    if (!produitId || !pointDeVenteId || quantite === undefined || !motif) {
      return NextResponse.json({ error: "produitId, pointDeVenteId, quantite, motif sont obligatoires" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const ancienStock = await tx.stockSite.findUnique({
        where: { produitId_pointDeVenteId: { produitId: Number(produitId), pointDeVenteId: Number(pointDeVenteId) } },
      });
      const ancienneQte = ancienStock?.quantite ?? 0;
      const diff = Number(quantite) - ancienneQte;

      const stock = await tx.stockSite.upsert({
        where: { produitId_pointDeVenteId: { produitId: Number(produitId), pointDeVenteId: Number(pointDeVenteId) } },
        update: { quantite: Number(quantite) },
        create: { produitId: Number(produitId), pointDeVenteId: Number(pointDeVenteId), quantite: Number(quantite) },
      });

      await tx.mouvementStock.create({
        data: {
          produitId:      Number(produitId),
          pointDeVenteId: Number(pointDeVenteId),
          type:           "AJUSTEMENT",
          typeEntree:     diff > 0 ? "AJUSTEMENT_POSITIF" : undefined,
          typeSortie:     diff < 0 ? "AJUSTEMENT_NEGATIF" : undefined,
          quantite:       Math.abs(diff),
          motif:          `Ajustement admin — ${motif}`,
          reference:      `ADJ-${randomUUID().slice(0, 8).toUpperCase()}`,
          operateurId:    parseInt(session.user.id),
        },
      });

      await auditLog(tx, parseInt(session.user.id), "AJUSTEMENT_STOCK", "StockSite", stock.id);
      return stock;
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("PATCH /admin/stock:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
