import { NextResponse } from "next/server";
import { TypeAnomalie, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";

/**
 * Résout le PDV actif du magasinier.
 */
async function getPDVMagasinier(userId: number) {
  const aff = await prisma.gestionnaireAffectation.findFirst({
    where: { userId, actif: true },
    select: { pointDeVenteId: true },
  });
  return aff?.pointDeVenteId ?? null;
}

/**
 * GET /api/magasinier/anomalies
 * Liste des anomalies du PDV du magasinier.
 * Query: statut, type, page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const pdvId = await getPDVMagasinier(parseInt(session.user.id));
    if (!pdvId) return NextResponse.json({ error: "Aucun point de vente associé à ce magasinier" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit  = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip   = (page - 1) * limit;
    const statut = searchParams.get("statut") || "";
    const type   = searchParams.get("type")   || "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { pointDeVenteId: pdvId };
    if (statut) where.statut = statut;
    if (type)   where.type   = type as TypeAnomalie;

    const [anomalies, total] = await Promise.all([
      prisma.anomalieStock.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          produit:      { select: { id: true, nom: true, reference: true } },
          pointDeVente: { select: { id: true, nom: true, code: true } },
          magasinier:   { select: { id: true, nom: true, prenom: true } },
          traiteur:     { select: { id: true, nom: true, prenom: true } },
        },
      }),
      prisma.anomalieStock.count({ where }),
    ]);

    const stats = await prisma.anomalieStock.groupBy({
      by: ["statut"],
      where: { pointDeVenteId: pdvId },
      _count: { id: true },
    });

    return NextResponse.json({
      data: anomalies,
      stats,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /magasinier/anomalies:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/magasinier/anomalies
 * Signaler une anomalie sur le PDV du magasinier.
 * Body: { produitId, type, quantite, description }
 */
export async function POST(req: Request) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);
    const pdvId  = await getPDVMagasinier(userId);
    if (!pdvId) return NextResponse.json({ error: "Aucun point de vente associé à ce magasinier" }, { status: 400 });

    const { produitId, type, quantite, description } = await req.json();

    if (!produitId || !type || !quantite || !description) {
      return NextResponse.json({ error: "produitId, type, quantite, description sont obligatoires" }, { status: 400 });
    }

    const typesValides: TypeAnomalie[] = ["MANQUANT", "SURPLUS", "DEFECTUEUX"];
    if (!typesValides.includes(type as TypeAnomalie)) {
      return NextResponse.json({ error: `Type invalide. Valeurs : ${typesValides.join(", ")}` }, { status: 400 });
    }

    const produit = await prisma.produit.findUnique({ where: { id: Number(produitId) }, select: { nom: true } });
    if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

    // Vérifier que le produit est bien en stock sur ce PDV
    const stockSite = await prisma.stockSite.findUnique({
      where: { produitId_pointDeVenteId: { produitId: Number(produitId), pointDeVenteId: pdvId } },
    });
    if (!stockSite) {
      return NextResponse.json({ error: "Ce produit n'est pas en stock sur votre PDV" }, { status: 400 });
    }

    const pdv = await prisma.pointDeVente.findUnique({ where: { id: pdvId }, select: { nom: true } });

    const anomalie = await prisma.$transaction(async (tx) => {
      const a = await tx.anomalieStock.create({
        data: {
          reference:     `ANO-${randomUUID().slice(0, 8).toUpperCase()}`,
          produitId:     Number(produitId),
          pointDeVenteId:pdvId,
          type:          type as TypeAnomalie,
          quantite:      Number(quantite),
          description,
          signalePar:    userId,
        },
        include: {
          produit:    { select: { nom: true } },
          magasinier: { select: { nom: true, prenom: true } },
        },
      });

      await auditLog(tx, userId, "ANOMALIE_STOCK_SIGNALEE", "AnomalieStock", a.id);

      const typeLabel: Record<string, string> = {
        MANQUANT:  "Manquant",
        SURPLUS:   "Surplus",
        DEFECTUEUX:"Défectueux",
      };

      await notifyRoles(tx, ["AGENT_LOGISTIQUE_APPROVISIONNEMENT", "RESPONSABLE_POINT_DE_VENTE"], {
        titre:    `Anomalie stock : ${typeLabel[type]} — ${produit.nom}`,
        message:  `${session.user.prenom} ${session.user.nom} a signalé une anomalie (${typeLabel[type]}) sur "${produit.nom}" (PDV : ${pdv?.nom}). Qté : ${quantite}. ${description}`,
        priorite: PrioriteNotification.HAUTE,
        actionUrl:`/dashboard/magasinier/anomalies/${a.id}`,
      });

      return a;
    });

    return NextResponse.json({ data: anomalie }, { status: 201 });
  } catch (error) {
    console.error("POST /magasinier/anomalies:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
