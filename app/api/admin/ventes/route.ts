import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { randomUUID } from "crypto";

/**
 * GET /api/admin/ventes
 * Liste toutes les ventes via credit alimentaire avec pagination et stats
 * Accessible par tout utilisateur authentifie (lecture seule)
 */
export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 10)));
    const skip = (page - 1) * limit;
    const search = searchParams.get("search") || "";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { produit: { nom: { contains: search, mode: "insensitive" } } },
        {
          creditAlimentaire: {
            member: {
              OR: [
                { nom: { contains: search, mode: "insensitive" } },
                { prenom: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    const [ventes, total] = await Promise.all([
      prisma.venteCreditAlimentaire.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          produit: {
            select: { id: true, nom: true, prixUnitaire: true },
          },
          creditAlimentaire: {
            select: {
              id: true,
              member: {
                select: { id: true, nom: true, prenom: true, email: true },
              },
            },
          },
        },
      }),
      prisma.venteCreditAlimentaire.count({ where }),
    ]);

    // Statistiques globales
    const agg = await prisma.venteCreditAlimentaire.aggregate({
      _count: { id: true },
      _sum: { prixUnitaire: true },
    });

    // Nombre de clients distincts (beneficiaires actifs)
    const distinctCredits = await prisma.venteCreditAlimentaire.findMany({
      select: { creditAlimentaireId: true },
      distinct: ["creditAlimentaireId"],
    });

    return NextResponse.json({
      data: ventes,
      stats: {
        totalVentes: agg._count.id ?? 0,
        montantTotal: agg._sum.prixUnitaire ?? 0,
        clientsActifs: distinctCredits.length,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /admin/ventes error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recuperation des ventes" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/ventes
 * Creer une nouvelle vente via credit alimentaire
 */
export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !session.user.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const body = await req.json();
    const { creditAlimentaireId, produitId, quantite } = body;

    if (!creditAlimentaireId || !produitId || !quantite) {
      return NextResponse.json(
        { error: "Champs obligatoires manquants (creditAlimentaireId, produitId, quantite)" },
        { status: 400 }
      );
    }

    if (Number(quantite) <= 0) {
      return NextResponse.json(
        { error: "La quantite doit etre superieure a 0" },
        { status: 400 }
      );
    }

    const creditAlim = await prisma.creditAlimentaire.findUnique({
      where: { id: Number(creditAlimentaireId) },
      include: { member: { select: { id: true, nom: true, prenom: true } } },
    });

    if (!creditAlim) {
      return NextResponse.json({ error: "Credit alimentaire introuvable" }, { status: 404 });
    }

    if (creditAlim.statut !== "ACTIF") {
      return NextResponse.json({ error: "Ce credit alimentaire n'est plus actif" }, { status: 400 });
    }

    const produit = await prisma.produit.findUnique({ where: { id: Number(produitId) } });
    if (!produit) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }

    if (produit.stock < Number(quantite)) {
      return NextResponse.json({ error: "Stock insuffisant" }, { status: 400 });
    }

    const montantTotal = Number(produit.prixUnitaire) * Number(quantite);

    if (montantTotal > Number(creditAlim.montantRestant)) {
      return NextResponse.json(
        { error: "Solde du credit alimentaire insuffisant" },
        { status: 400 }
      );
    }

    const vente = await prisma.$transaction(async (tx) => {
      const created = await tx.venteCreditAlimentaire.create({
        data: {
          creditAlimentaireId: Number(creditAlimentaireId),
          produitId: Number(produitId),
          quantite: Number(quantite),
          prixUnitaire: produit.prixUnitaire,
        },
        include: {
          produit: { select: { id: true, nom: true, prixUnitaire: true } },
          creditAlimentaire: {
            select: {
              id: true,
              member: { select: { id: true, nom: true, prenom: true, email: true } },
            },
          },
        },
      });

      const newUtilise = Number(creditAlim.montantUtilise) + montantTotal;
      const newRestant = Number(creditAlim.plafond) - newUtilise;

      await tx.creditAlimentaire.update({
        where: { id: Number(creditAlimentaireId) },
        data: {
          montantUtilise: new Prisma.Decimal(newUtilise),
          montantRestant: new Prisma.Decimal(Math.max(0, newRestant)),
          statut: newRestant <= 0 ? "EPUISE" : "ACTIF",
        },
      });

      await tx.produit.update({
        where: { id: Number(produitId) },
        data: { stock: { decrement: Number(quantite) } },
      });

      await tx.mouvementStock.create({
        data: {
          produitId: Number(produitId),
          type: "SORTIE",
          quantite: Number(quantite),
          motif: `Vente credit alimentaire #${created.id}`,
          reference: `VENTE-${randomUUID()}`,
        },
      });

      return created;
    });

    return NextResponse.json({ data: vente }, { status: 201 });
  } catch (error) {
    console.error("POST /admin/ventes error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la creation de la vente" },
      { status: 500 }
    );
  }
}
