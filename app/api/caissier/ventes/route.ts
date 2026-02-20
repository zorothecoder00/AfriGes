import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCaissierSession } from "@/lib/authCaissier";
import { randomUUID } from "crypto";

/**
 * GET /api/caissier/ventes
 *
 * Liste les ventes avec pagination, recherche et filtre de date.
 * Paramètres : page, limit, search, dateDebut, dateFin, aujourdHui (bool)
 */
export async function GET(req: Request) {
  try {
    const session = await getCaissierSession();
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page        = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit       = Math.min(50, Math.max(5, Number(searchParams.get("limit") ?? "15")));
    const skip        = (page - 1) * limit;
    const search      = searchParams.get("search") ?? "";
    const dateDebut   = searchParams.get("dateDebut");
    const dateFin     = searchParams.get("dateFin");
    const aujourdHui  = searchParams.get("aujourdHui") === "true";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (aujourdHui) {
      const now = new Date();
      where.createdAt = {
        gte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0),
        lte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
      };
    } else if (dateDebut || dateFin) {
      where.createdAt = {};
      if (dateDebut) where.createdAt.gte = new Date(dateDebut);
      if (dateFin)   where.createdAt.lte = new Date(dateFin + "T23:59:59.999Z");
    }

    if (search) {
      where.OR = [
        { produit: { nom: { contains: search, mode: "insensitive" } } },
        {
          creditAlimentaire: {
            member: {
              OR: [
                { nom:    { contains: search, mode: "insensitive" } },
                { prenom: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        },
        {
          creditAlimentaire: {
            client: {
              OR: [
                { nom:    { contains: search, mode: "insensitive" } },
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
          produit: { select: { id: true, nom: true, prixUnitaire: true } },
          creditAlimentaire: {
            select: {
              id: true,
              plafond: true,
              montantRestant: true,
              member: { select: { id: true, nom: true, prenom: true, email: true } },
              client: { select: { id: true, nom: true, prenom: true, telephone: true } },
            },
          },
        },
      }),
      prisma.venteCreditAlimentaire.count({ where }),
    ]);

    // Stats sur la période filtrée
    const aggPeriode = await prisma.venteCreditAlimentaire.aggregate({
      where,
      _count: { id: true },
      _sum:   { quantite: true },
    });

    // Montant total calculé depuis les ventes récupérées (pour précision avec Decimal)
    const ventesToutes = await prisma.venteCreditAlimentaire.findMany({
      where,
      select: { quantite: true, prixUnitaire: true },
    });
    const montantPeriode = ventesToutes.reduce(
      (s, v) => s + Number(v.prixUnitaire) * v.quantite, 0
    );
    const panierMoyenPeriode = (aggPeriode._count.id ?? 0) > 0
      ? montantPeriode / (aggPeriode._count.id ?? 1)
      : 0;

    return NextResponse.json({
      success: true,
      data: ventes,
      stats: {
        totalVentes:   aggPeriode._count.id ?? 0,
        montantTotal:  montantPeriode,
        panierMoyen:   panierMoyenPeriode,
        quantiteTotale: aggPeriode._sum.quantite ?? 0,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error("GET /api/caissier/ventes error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/caissier/ventes
 *
 * Enregistre une nouvelle vente via crédit alimentaire.
 * Body : { creditAlimentaireId, produitId, quantite }
 *
 * Règles métier :
 *  - Crédit alimentaire doit être ACTIF
 *  - Stock produit suffisant
 *  - Solde crédit alimentaire suffisant
 *  - Met à jour le stock, le crédit et crée un mouvement
 */
export async function POST(req: Request) {
  try {
    const session = await getCaissierSession();
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const body = await req.json();
    const { creditAlimentaireId, produitId, quantite } = body;

    if (!creditAlimentaireId || !produitId || !quantite) {
      return NextResponse.json(
        { message: "Champs obligatoires manquants (creditAlimentaireId, produitId, quantite)" },
        { status: 400 }
      );
    }

    const qte = Number(quantite);
    if (!Number.isInteger(qte) || qte <= 0) {
      return NextResponse.json({ message: "La quantité doit être un entier positif" }, { status: 400 });
    }

    // Charger les entités
    const [creditAlim, produit] = await Promise.all([
      prisma.creditAlimentaire.findUnique({
        where: { id: Number(creditAlimentaireId) },
        include: {
          member: { select: { id: true, nom: true, prenom: true } },
          client: { select: { id: true, nom: true, prenom: true } },
        },
      }),
      prisma.produit.findUnique({ where: { id: Number(produitId) } }),
    ]);

    if (!creditAlim) {
      return NextResponse.json({ message: "Crédit alimentaire introuvable" }, { status: 404 });
    }
    if (creditAlim.statut !== "ACTIF") {
      return NextResponse.json({ message: "Ce crédit alimentaire n'est plus actif" }, { status: 400 });
    }
    if (!produit) {
      return NextResponse.json({ message: "Produit introuvable" }, { status: 404 });
    }
    if (produit.stock < qte) {
      return NextResponse.json(
        { message: `Stock insuffisant (disponible : ${produit.stock})` },
        { status: 400 }
      );
    }

    const montantTotal = Number(produit.prixUnitaire) * qte;
    if (montantTotal > Number(creditAlim.montantRestant)) {
      return NextResponse.json(
        {
          message: `Solde insuffisant (restant : ${Number(creditAlim.montantRestant).toLocaleString("fr-FR")} FCFA, requis : ${montantTotal.toLocaleString("fr-FR")} FCFA)`,
        },
        { status: 400 }
      );
    }

    // Transaction atomique
    const vente = await prisma.$transaction(async (tx) => {
      const created = await tx.venteCreditAlimentaire.create({
        data: {
          creditAlimentaireId: Number(creditAlimentaireId),
          produitId:           Number(produitId),
          quantite:            qte,
          prixUnitaire:        produit.prixUnitaire,
        },
        include: {
          produit: { select: { id: true, nom: true, prixUnitaire: true } },
          creditAlimentaire: {
            select: {
              id: true,
              member: { select: { id: true, nom: true, prenom: true, email: true } },
              client: { select: { id: true, nom: true, prenom: true, telephone: true } },
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
          statut:         newRestant <= 0 ? "EPUISE" : "ACTIF",
        },
      });

      await tx.produit.update({
        where: { id: Number(produitId) },
        data:  { stock: { decrement: qte } },
      });

      await tx.mouvementStock.create({
        data: {
          produitId:    Number(produitId),
          type:         "SORTIE",
          quantite:     qte,
          motif:        `Vente caisse #${created.id}`,
          reference:    `CAISSE-${randomUUID()}`,
        },
      });

      return created;
    });

    return NextResponse.json(
      { success: true, message: "Vente enregistrée avec succès", data: vente },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/caissier/ventes error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
