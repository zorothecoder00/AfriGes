import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLogistiqueSession } from "@/lib/authLogistique";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { resolveViewAs } from "@/lib/viewAs";
import { randomUUID } from "crypto";

async function getAnySession() {
  return (await getLogistiqueSession()) ?? (await getMagasinierSession());
}

/**
 * GET /api/logistique/mouvements
 * Journal complet de tous les mouvements de stock (ENTREE, SORTIE, AJUSTEMENT).
 * Utilisé pour l'onglet suivi des livraisons et journal d'audit.
 */  
export async function GET(req: NextRequest) {
  try {
    const session = await getLogistiqueSession();
    if (!session) return NextResponse.json({ error: "Acces refuse" }, { status: 403 });

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const viewAs  = isAdmin ? resolveViewAs(req) : null;
    const effectiveUserId = viewAs?.userId ?? Number(session.user.id);

    const affectation = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: effectiveUserId, actif: true },
      select: { pointDeVenteId: true },
    });
    if (!affectation) {
      return NextResponse.json({ error: "Aucun point de vente actif trouvé pour cet utilisateur" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const page      = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit     = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip      = (page - 1) * limit;
    const search    = ( searchParams.get("search") || "" ).trim();
    const typeParam = searchParams.get("type");
    const produitId = searchParams.get("produitId");

    const where: Prisma.MouvementStockWhereInput = {
      pointDeVenteId: affectation.pointDeVenteId,
      ...(typeParam && ["ENTREE", "SORTIE", "AJUSTEMENT"].includes(typeParam) && {
        type: typeParam as "ENTREE" | "SORTIE" | "AJUSTEMENT",
      }),
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
        include: { produit: { select: { id: true, nom: true } } },
      }),
      prisma.mouvementStock.count({ where }),
    ]);

    // Stats globales (30 derniers jours)
    const since30j = new Date();
    since30j.setDate(since30j.getDate() - 30);

    const [totalEntrees, totalSorties, totalAjustements] = await Promise.all([
      prisma.mouvementStock.count({ where: { pointDeVenteId: affectation.pointDeVenteId, type: "ENTREE",     dateMouvement: { gte: since30j } } }),
      prisma.mouvementStock.count({ where: { pointDeVenteId: affectation.pointDeVenteId, type: "SORTIE",     dateMouvement: { gte: since30j } } }),
      prisma.mouvementStock.count({ where: { pointDeVenteId: affectation.pointDeVenteId, type: "AJUSTEMENT", dateMouvement: { gte: since30j } } }),
    ]);

    return NextResponse.json({
      data:  mouvements,
      stats: { totalEntrees, totalSorties, totalAjustements },
      meta:  { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /logistique/mouvements error:", error);
    return NextResponse.json({ error: "Erreur lors du chargement du journal" }, { status: 500 });
  }
}

/**
 * POST /api/logistique/mouvements
 * Entrée rapide de stock (réception manuelle depuis le tab stock).
 * Body: { produitId, quantite, motif?, referenceExterne? }
 * Crée un MouvementStock ENTREE et met à jour StockSite.quantite.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAnySession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { produitId, quantite, motif, referenceExterne } = await req.json() as {
      produitId: number;
      quantite: number;
      motif?: string;
      referenceExterne?: string;
    };

    if (!produitId || !quantite || Number(quantite) <= 0) {
      return NextResponse.json({ error: "produitId et quantite (> 0) sont obligatoires" }, { status: 400 });
    }

    const userId = parseInt(session.user.id);

    // Résoudre le PDV de l'utilisateur
    const affectation = await prisma.gestionnaireAffectation.findFirst({
      where: { userId, actif: true },
      select: { pointDeVenteId: true },
    });
    if (!affectation) {
      return NextResponse.json({ error: "Aucun point de vente assigné à cet utilisateur" }, { status: 400 });
    }
    const pdvId = affectation.pointDeVenteId;

    const mouvement = await prisma.$transaction(async (tx) => {
      const ref = referenceExterne || `ENT-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;

      const m = await tx.mouvementStock.create({
        data: {
          produitId:     Number(produitId),
          pointDeVenteId: pdvId,
          type:          "ENTREE",
          typeEntree:    "RECEPTION_FOURNISSEUR",
          quantite:      Number(quantite),
          motif:         motif || null,
          reference:     ref,
          operateurId:   userId,
        },
      });

      // Mettre à jour le stock réel du PDV
      await tx.stockSite.upsert({
        where:  { produitId_pointDeVenteId: { produitId: Number(produitId), pointDeVenteId: pdvId } },
        update: { quantite: { increment: Number(quantite) } },
        create: { produitId: Number(produitId), pointDeVenteId: pdvId, quantite: Number(quantite) },
      });

      return m;
    });

    return NextResponse.json({ data: mouvement }, { status: 201 });
  } catch (error) {
    console.error("POST /logistique/mouvements error:", error);
    return NextResponse.json({ error: "Erreur lors de l'enregistrement" }, { status: 500 });
  }
}
