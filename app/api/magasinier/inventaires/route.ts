import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { getRPVSession } from "@/lib/authRPV";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";

async function getSession() {
  return (await getMagasinierSession()) ?? (await getRPVSession());
}

/**
 * GET /api/magasinier/inventaires
 * Liste des inventaires de site.
 * Query: statut, pdvId, page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit  = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 15)));
    const skip   = (page - 1) * limit;
    const statut = searchParams.get("statut") || "";
    const pdvId  = searchParams.get("pdvId");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut) where.statut = statut;
    if (pdvId)  where.pointDeVenteId = Number(pdvId);

    const [inventaires, total, pdvs] = await Promise.all([
      prisma.inventaireSite.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          pointDeVente: { select: { id: true, nom: true, code: true } },
          realisePar:   { select: { id: true, nom: true, prenom: true } },
          validePar:    { select: { id: true, nom: true, prenom: true } },
          _count: { select: { lignes: true } },
        },
      }),
      prisma.inventaireSite.count({ where }),
      prisma.pointDeVente.findMany({ where: { actif: true }, select: { id: true, nom: true, code: true, type: true }, orderBy: { nom: "asc" } }),
    ]);

    return NextResponse.json({
      data: inventaires,
      pdvs,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /magasinier/inventaires:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/magasinier/inventaires
 * Démarrer un inventaire sur un PDV — capture le stock système actuel.
 * Body: { pointDeVenteId, notes? }
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { pointDeVenteId, notes } = await req.json();
    if (!pointDeVenteId) {
      return NextResponse.json({ error: "pointDeVenteId est obligatoire" }, { status: 400 });
    }

    // Charger tous les stocks actuels du PDV
    const stocksActuels = await prisma.stockSite.findMany({
      where: { pointDeVenteId: Number(pointDeVenteId) },
      include: { produit: { select: { actif: true } } },
    });
    const stocksActifs = stocksActuels.filter(s => s.produit.actif);

    if (stocksActifs.length === 0) {
      return NextResponse.json({ error: "Aucun produit en stock sur ce PDV" }, { status: 400 });
    }

    const inventaire = await prisma.$transaction(async (tx) => {
      const ref = `INV-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;

      const inv = await tx.inventaireSite.create({
        data: {
          reference:      ref,
          statut:         "EN_COURS",
          pointDeVenteId: Number(pointDeVenteId),
          notes:          notes || null,
          realiseParId:   parseInt(session.user.id),
          // Créer une ligne par produit avec la quantité système actuelle
          lignes: {
            create: stocksActifs.map(s => ({
              produitId:        s.produitId,
              quantiteSysteme:  s.quantite,
              quantiteConstatee:0, // à saisir lors du comptage physique
              ecart:            -s.quantite,
            })),
          },
        },
        include: {
          pointDeVente: { select: { nom: true } },
          _count: { select: { lignes: true } },
        },
      });

      await auditLog(tx, parseInt(session.user.id), "INVENTAIRE_DEMARRE", "InventaireSite", inv.id);
      return inv;
    });

    return NextResponse.json({ data: inventaire }, { status: 201 });
  } catch (error) {
    console.error("POST /magasinier/inventaires:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
