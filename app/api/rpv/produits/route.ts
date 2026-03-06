import { NextResponse } from "next/server";
import { Prisma, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";

/**
 * GET /api/rpv/produits
 * Liste les produits avec pagination, recherche et filtre de statut stock.
 * Paramètres : page, limit, search, statut (EN_STOCK|STOCK_FAIBLE|RUPTURE)
 */
export async function GET(req: Request) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit  = Math.min(50, Math.max(5, Number(searchParams.get("limit") ?? "15")));
    const search = searchParams.get("search") ?? "";
    const statut = searchParams.get("statut") ?? "";

    const where: Prisma.ProduitWhereInput = {};
    if (search) {
      where.OR = [
        { nom:         { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // Le stock est localisé dans StockSite — on fetch tout et on filtre en mémoire
    const allProduits = await prisma.produit.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: { stocks: { select: { quantite: true } } },
    });

    // Ajouter totalStock calculé à chaque produit
    const produitsAvecStock = allProduits.map((p) => ({
      ...p,
      totalStock: p.stocks.reduce((s, ss) => s + ss.quantite, 0),
    }));

    // Filtres de statut en mémoire
    let filtered = produitsAvecStock;
    if (statut === "RUPTURE")     filtered = produitsAvecStock.filter((p) => p.totalStock === 0);
    if (statut === "STOCK_FAIBLE") filtered = produitsAvecStock.filter((p) => p.totalStock > 0 && p.totalStock <= p.alerteStock);

    const total     = filtered.length;
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    // Statistiques globales
    const enRupture    = produitsAvecStock.filter((p) => p.totalStock === 0).length;
    const stockFaible  = produitsAvecStock.filter((p) => p.totalStock > 0 && p.totalStock <= p.alerteStock).length;
    const valeurTotale = produitsAvecStock.reduce((s, p) => s + Number(p.prixUnitaire) * p.totalStock, 0);

    return NextResponse.json({
      success: true,
      data: paginated.map(({ stocks: _stocks, ...p }) => ({ ...p, prixUnitaire: Number(p.prixUnitaire) })),
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

/**
 * POST /api/rpv/produits
 * Crée un nouveau produit. Si stock initial > 0, crée un StockSite + mouvement ENTREE.
 * Body : { nom, prixUnitaire, description?, stock?, alerteStock? }
 */
export async function POST(req: Request) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { nom, prixUnitaire, description, stock, alerteStock } = await req.json();

    if (!nom || !prixUnitaire) {
      return NextResponse.json({ message: "nom et prixUnitaire sont requis" }, { status: 400 });
    }
    if (Number(prixUnitaire) <= 0) {
      return NextResponse.json({ message: "Le prix unitaire doit être positif" }, { status: 400 });
    }

    const stockInit = Math.max(0, Number(stock ?? 0));

    // Récupérer le PDV du RPV pour créer le StockSite initial
    const affectation = stockInit > 0
      ? await prisma.gestionnaireAffectation.findFirst({
          where: { userId: parseInt(session.user.id), actif: true },
          select: { pointDeVenteId: true },
        })
      : null;

    const produit = await prisma.$transaction(async (tx) => {
      const created = await tx.produit.create({
        data: {
          nom,
          prixUnitaire: new Prisma.Decimal(Number(prixUnitaire)),
          description:  description ?? null,
          alerteStock:  Number(alerteStock ?? 0),
        },
      });

      if (stockInit > 0 && affectation) {
        await tx.stockSite.create({
          data: {
            produitId:      created.id,
            pointDeVenteId: affectation.pointDeVenteId,
            quantite:       stockInit,
          },
        });
        await tx.mouvementStock.create({
          data: {
            produitId:      created.id,
            pointDeVenteId: affectation.pointDeVenteId,
            type:           "ENTREE",
            quantite:       stockInit,
            motif:          `Stock initial — créé par ${session.user.name ?? "RPV"}`,
            reference:      `RPV-INIT-${randomUUID()}`,
          },
        });
      }

      await auditLog(tx, parseInt(session.user.id), "CREATION_PRODUIT_RPV", "Produit", created.id);

      await notifyRoles(
        tx,
        ["MAGAZINIER", "AGENT_LOGISTIQUE_APPROVISIONNEMENT"],
        {
          titre:    `Nouveau produit : ${nom}`,
          message:  `${session.user.name ?? "RPV"} a créé le produit "${nom}" (prix : ${Number(prixUnitaire).toLocaleString("fr-FR")} FCFA${stockInit > 0 ? `, stock initial : ${stockInit}` : ""}).`,
          priorite: PrioriteNotification.BASSE,
          actionUrl: `/dashboard/admin/stock`,
        }
      );

      return created;
    });

    return NextResponse.json(
      { success: true, message: "Produit créé avec succès", data: { ...produit, prixUnitaire: Number(produit.prixUnitaire) } },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/rpv/produits error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
