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
 * Résout le PDV de l'utilisateur connecté (magasinier via affectation, RPV via rpvId).
 */
async function getOwnPDV(userId: number): Promise<number | null> {
  const aff = await prisma.gestionnaireAffectation.findFirst({
    where: { userId, actif: true },
    select: { pointDeVenteId: true },
  });
  if (aff?.pointDeVenteId) return aff.pointDeVenteId;

  const pdv = await prisma.pointDeVente.findUnique({
    where: { rpvId: userId },
    select: { id: true },
  });
  return pdv?.id ?? null;
}

/**
 * GET /api/magasinier/inventaires
 * Liste des inventaires du PDV du magasinier/RPV connecté.
 * Query: statut, page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const pdvId = await getOwnPDV(parseInt(session.user.id));
    if (!pdvId) return NextResponse.json({ error: "Aucun point de vente associé" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit  = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 15)));
    const skip   = (page - 1) * limit;
    const statut = searchParams.get("statut") || "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { pointDeVenteId: pdvId };
    if (statut) where.statut = statut;

    const [inventaires, total] = await Promise.all([
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
    ]);

    return NextResponse.json({
      data: inventaires,
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

    // Forcer le PDV du magasinier/RPV connecté
    const pointDeVenteId = await getOwnPDV(parseInt(session.user.id));
    if (!pointDeVenteId) {
      return NextResponse.json({ error: "Aucun point de vente associé" }, { status: 400 });
    }

    const { notes } = await req.json();

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
