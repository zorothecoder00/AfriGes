import { NextResponse } from "next/server";
import { Prisma, Role, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLogistiqueSession } from "@/lib/authLogistique";
import { randomUUID } from "crypto";

/**
 * GET /api/logistique/receptions
 * Liste l'historique de toutes les entrées de stock (réceptions logistique).
 */
export async function GET(req: Request) {
  try {
    const session = await getLogistiqueSession();
    if (!session) return NextResponse.json({ error: "Acces refuse" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page     = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit    = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 15)));
    const skip     = (page - 1) * limit;
    const search   = searchParams.get("search") || "";
    const produitId = searchParams.get("produitId");

    const where: Prisma.MouvementStockWhereInput = {
      type: "ENTREE",
      reference: { startsWith: "LOG-REC-" },
      ...(produitId && !isNaN(Number(produitId)) && { produitId: Number(produitId) }),
      ...(search && {
        OR: [
          { motif:     { contains: search, mode: "insensitive" } },
          { reference: { contains: search, mode: "insensitive" } },
          { produit:   { nom: { contains: search, mode: "insensitive" } } },
        ],
      }),
    };

    const [mouvements, total] = await Promise.all([
      prisma.mouvementStock.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dateMouvement: "desc" },
        include: { produit: { select: { id: true, nom: true, stock: true, prixUnitaire: true } } },
      }),
      prisma.mouvementStock.count({ where }),
    ]);

    // Stats 30 derniers jours
    const since30j = new Date();
    since30j.setDate(since30j.getDate() - 30);

    const [totalReceptions30j, sumResult] = await Promise.all([
      prisma.mouvementStock.count({
        where: { type: "ENTREE", reference: { startsWith: "LOG-REC-" }, dateMouvement: { gte: since30j } },
      }),
      prisma.mouvementStock.aggregate({
        where: { type: "ENTREE", reference: { startsWith: "LOG-REC-" }, dateMouvement: { gte: since30j } },
        _sum: { quantite: true },
      }),
    ]);

    return NextResponse.json({
      data:  mouvements,
      stats: {
        totalReceptions30j,
        totalQuantiteRecue30j: sumResult._sum.quantite ?? 0,
      },
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /logistique/receptions error:", error);
    return NextResponse.json({ error: "Erreur lors du chargement des receptions" }, { status: 500 });
  }
}

/**
 * POST /api/logistique/receptions
 * Réceptionner un lot de marchandises :
 * - Crée un MouvementStock ENTREE (ref LOG-REC-*)
 * - Met à jour le stock du produit
 * - Notifie les admins et les magasiniers
 */
export async function POST(req: Request) {
  try {
    const session = await getLogistiqueSession();
    if (!session) return NextResponse.json({ error: "Acces refuse" }, { status: 403 });

    const body = await req.json();
    const { produitId, quantite, referenceExterne, motif } = body;

    if (!produitId || !quantite) {
      return NextResponse.json(
        { error: "Champs obligatoires manquants (produitId, quantite)" },
        { status: 400 }
      );
    }

    const qty = Number(quantite);
    if (!Number.isInteger(qty) || qty <= 0) {
      return NextResponse.json(
        { error: "La quantite doit etre un entier superieur a 0" },
        { status: 400 }
      );
    }

    const produit = await prisma.produit.findUnique({ where: { id: Number(produitId) } });
    if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

    const newStock = produit.stock + qty;
    const operateur = `${session.user.prenom} ${session.user.nom}`;
    const motifComplet = [
      motif ? motif : "Reception de marchandises",
      referenceExterne ? `(Ref ext. : ${referenceExterne})` : null,
      `par ${operateur}`,
    ]
      .filter(Boolean)
      .join(" — ");

    const result = await prisma.$transaction(async (tx) => {
      const mouvement = await tx.mouvementStock.create({
        data: {
          produitId:    Number(produitId),
          type:         "ENTREE",
          quantite:     qty,
          motif:        motifComplet,
          reference:    `LOG-REC-${randomUUID()}`,
          dateMouvement: new Date(),
        },
        include: { produit: { select: { id: true, nom: true } } },
      });

      const updated = await tx.produit.update({
        where: { id: Number(produitId) },
        data:  { stock: newStock },
      });

      await tx.auditLog.create({
        data: {
          userId:   parseInt(session.user.id),
          action:   "RECEPTION_LOGISTIQUE",
          entite:   "MouvementStock",
          entiteId: mouvement.id,
        },
      });

      // Notifier les admins
      const admins = await tx.user.findMany({
        where:  { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
        select: { id: true },
      });

      // Notifier les magasiniers
      const magasiniers = await tx.user.findMany({
        where:  { gestionnaire: { role: "MAGAZINIER", actif: true } },
        select: { id: true },
      });

      const destinataires = [
        ...admins.map(u => u.id),
        ...magasiniers.map(u => u.id),
      ];
      const uniqueDestinataires = [...new Set(destinataires)];

      if (uniqueDestinataires.length > 0) {
        await tx.notification.createMany({
          data: uniqueDestinataires.map((userId) => ({
            userId,
            titre:   `Reception : ${produit.nom}`,
            message: `${operateur} a receptionne ${qty} unite(s) de "${produit.nom}". Stock : ${produit.stock} → ${newStock}${referenceExterne ? ` | Ref : ${referenceExterne}` : ""}.`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/admin/stock/${produit.id}`,
          })),
        });
      }

      return { mouvement, produit: updated };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /logistique/receptions error:", error);
    return NextResponse.json({ error: "Erreur lors de la reception" }, { status: 500 });
  }
}
