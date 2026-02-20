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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (search) {
      where.OR = [
        { nom:         { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }
    if (statut === "RUPTURE")     where.stock = 0;
    if (statut === "STOCK_FAIBLE") where.AND = [{ stock: { gt: 0 } }, { stock: { lte: prisma.produit.fields.alerteStock } }];

    // Filtre stock_faible : stock > 0 AND stock <= alerteStock (comparaison runtime)
    // On ne peut pas faire ça directement en Prisma sans raw query, on filtre post-fetch pour STOCK_FAIBLE
    const [allProduits, stats] = await Promise.all([
      prisma.produit.findMany({
        where: statut === "STOCK_FAIBLE" ? (search ? { OR: where.OR } : {}) : where,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.produit.aggregate({
        _count: { id: true },
        _sum:   { stock: true },
      }),
    ]);

    // Appliquer filtre STOCK_FAIBLE en mémoire (stock > 0 && stock <= alerteStock)
    let filtered = allProduits;
    if (statut === "STOCK_FAIBLE") {
      filtered = allProduits.filter((p) => p.stock > 0 && p.stock <= p.alerteStock);
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter((p) => p.nom.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q));
      }
    }

    const total    = filtered.length;
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    // Statistiques globales (toujours sur tous les produits)
    const enRupture   = allProduits.filter((p) => p.stock === 0).length;
    const stockFaible = allProduits.filter((p) => p.stock > 0 && p.stock <= p.alerteStock).length;
    const valeurTotale= allProduits.reduce((s, p) => s + Number(p.prixUnitaire) * p.stock, 0);

    return NextResponse.json({
      success: true,
      data: paginated.map((p) => ({ ...p, prixUnitaire: Number(p.prixUnitaire) })),
      stats: {
        totalProduits: stats._count.id ?? 0,
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
 * Crée un nouveau produit. Si stock initial > 0, crée un mouvement ENTREE.
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

    const produit = await prisma.$transaction(async (tx) => {
      const created = await tx.produit.create({
        data: {
          nom,
          prixUnitaire: new Prisma.Decimal(Number(prixUnitaire)),
          description:  description ?? null,
          stock:        stockInit,
          alerteStock:  Number(alerteStock ?? 0),
        },
      });
      if (stockInit > 0) {
        await tx.mouvementStock.create({
          data: {
            produitId:    created.id,
            type:         "ENTREE",
            quantite:     stockInit,
            motif:        `Stock initial — créé par ${session.user.name ?? "RPV"}`,
            reference:    `RPV-INIT-${randomUUID()}`,
          },
        });
      }

      // Audit log
      await auditLog(tx, parseInt(session.user.id), "CREATION_PRODUIT_RPV", "Produit", created.id);

      // Notifications : Admin + Magasinier + Logistique
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
