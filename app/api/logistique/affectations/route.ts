import { NextResponse } from "next/server";
import { Prisma, Role, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLogistiqueSession } from "@/lib/authLogistique";
import { randomUUID } from "crypto";

/**
 * GET /api/logistique/affectations
 * Liste toutes les affectations de stock vers les points de vente (SORTIE LOG-AFF-*).
 * Retourne aussi la liste des responsables de points de vente pour le formulaire.
 */
export async function GET(req: Request) {
  try {
    const session = await getLogistiqueSession();
    if (!session) return NextResponse.json({ error: "Acces refuse" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page    = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit   = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 15)));
    const skip    = (page - 1) * limit;
    const search  = searchParams.get("search") || "";
    const produitId = searchParams.get("produitId");

    const where: Prisma.MouvementStockWhereInput = {
      type: "SORTIE",
      reference: { startsWith: "LOG-AFF-" },
      ...(produitId && !isNaN(Number(produitId)) && { produitId: Number(produitId) }),
      ...(search && {
        OR: [
          { motif:     { contains: search, mode: "insensitive" } },
          { reference: { contains: search, mode: "insensitive" } },
          { produit:   { nom: { contains: search, mode: "insensitive" } } },
        ],
      }),
    };

    const [mouvements, total, responsables] = await Promise.all([
      prisma.mouvementStock.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dateMouvement: "desc" },
        include: { produit: { select: { id: true, nom: true, stock: true } } },
      }),
      prisma.mouvementStock.count({ where }),
      // Responsables de points de vente pour le formulaire d'affectation
      prisma.user.findMany({
        where: { gestionnaire: { role: "RESPONSABLE_POINT_DE_VENTE", actif: true } },
        select: { id: true, nom: true, prenom: true },
        orderBy: { nom: "asc" },
      }),
    ]);

    // Stats 30 derniers jours
    const since30j = new Date();
    since30j.setDate(since30j.getDate() - 30);

    const [totalAffectations30j, sumResult] = await Promise.all([
      prisma.mouvementStock.count({
        where: { type: "SORTIE", reference: { startsWith: "LOG-AFF-" }, dateMouvement: { gte: since30j } },
      }),
      prisma.mouvementStock.aggregate({
        where: { type: "SORTIE", reference: { startsWith: "LOG-AFF-" }, dateMouvement: { gte: since30j } },
        _sum: { quantite: true },
      }),
    ]);

    return NextResponse.json({
      data:  mouvements,
      responsables,
      stats: {
        totalAffectations30j,
        totalQuantiteAffectee30j: sumResult._sum.quantite ?? 0,
      },
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /logistique/affectations error:", error);
    return NextResponse.json({ error: "Erreur lors du chargement des affectations" }, { status: 500 });
  }
}

/**
 * POST /api/logistique/affectations
 * Affecter du stock à un point de vente :
 * - Valide que le stock est suffisant
 * - Crée un MouvementStock SORTIE (ref LOG-AFF-*)
 * - Décrémente le stock du produit
 * - Notifie les admins et les magasiniers
 */
export async function POST(req: Request) {
  try {
    const session = await getLogistiqueSession();
    if (!session) return NextResponse.json({ error: "Acces refuse" }, { status: 403 });

    const body = await req.json();
    const { produitId, quantite, pointDeVente, notes } = body;

    if (!produitId || !quantite || !pointDeVente) {
      return NextResponse.json(
        { error: "Champs obligatoires manquants (produitId, quantite, pointDeVente)" },
        { status: 400 }
      );
    }

    if (!pointDeVente.trim()) {
      return NextResponse.json(
        { error: "Le nom du point de vente est obligatoire" },
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

    if (produit.stock < qty) {
      return NextResponse.json(
        { error: `Stock insuffisant. Stock disponible : ${produit.stock} unite(s), demande : ${qty}.` },
        { status: 400 }
      );
    }

    const newStock = produit.stock - qty;
    const operateur = `${session.user.prenom} ${session.user.nom}`;
    const motifComplet = [
      `Affectation PdV : ${pointDeVente.trim()}`,
      notes ? notes.trim() : null,
      `par ${operateur}`,
    ]
      .filter(Boolean)
      .join(" — ");

    const result = await prisma.$transaction(async (tx) => {
      const mouvement = await tx.mouvementStock.create({
        data: {
          produitId:     Number(produitId),
          type:          "SORTIE",
          quantite:      qty,
          motif:         motifComplet,
          reference:     `LOG-AFF-${randomUUID()}`,
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
          action:   "AFFECTATION_STOCK_PDV",
          entite:   "MouvementStock",
          entiteId: mouvement.id,
        },
      });

      // Notifier admins
      const admins = await tx.user.findMany({
        where:  { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
        select: { id: true },
      });

      // Notifier magasiniers
      const magasiniers = await tx.user.findMany({
        where:  { gestionnaire: { role: "MAGAZINIER", actif: true } },
        select: { id: true },
      });

      const uniqueDestinataires = [...new Set([
        ...admins.map(u => u.id),
        ...magasiniers.map(u => u.id),
      ])];

      if (uniqueDestinataires.length > 0) {
        await tx.notification.createMany({
          data: uniqueDestinataires.map((userId) => ({
            userId,
            titre:    `Affectation stock : ${produit.nom}`,
            message:  `${operateur} a affecte ${qty} unite(s) de "${produit.nom}" au point de vente "${pointDeVente}". Stock : ${produit.stock} → ${newStock}.`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/admin/stock/${produit.id}`,
          })),
        });
      }

      return { mouvement, produit: updated };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /logistique/affectations error:", error);
    return NextResponse.json({ error: "Erreur lors de l'affectation" }, { status: 500 });
  }
}
