import { NextResponse } from "next/server";
import { TypeAnomalie, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { randomUUID } from "crypto";
import { notifyRoles } from "@/lib/notifications";

/**
 * GET /api/magasinier/anomalies
 * Liste des anomalies signalées
 */
export async function GET(req: Request) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Acces refuse" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip  = (page - 1) * limit;
    const statut = searchParams.get("statut");
    const type   = searchParams.get("type");

    const where = {
      ...(statut && { statut: statut as "EN_ATTENTE" | "EN_COURS" | "TRAITEE" | "TRANSMISE" }),
      ...(type   && { type:   type   as TypeAnomalie }),
    };

    const [anomalies, total] = await Promise.all([
      prisma.anomalieStock.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          produit:    { select: { id: true, nom: true, stock: true } },
          magasinier: { select: { id: true, nom: true, prenom: true } },
          traiteur:   { select: { id: true, nom: true, prenom: true } },
        },
      }),
      prisma.anomalieStock.count({ where }),
    ]);

    const stats = await prisma.anomalieStock.groupBy({
      by: ["statut"],
      _count: { id: true },
    });

    return NextResponse.json({
      data: anomalies,
      stats,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /magasinier/anomalies:", error);
    return NextResponse.json({ error: "Erreur lors du chargement" }, { status: 500 });
  }
}

/**
 * POST /api/magasinier/anomalies
 * Signaler une nouvelle anomalie
 */
export async function POST(req: Request) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Acces refuse" }, { status: 403 });

    const body = await req.json();
    const { produitId, type, quantite, description } = body;

    if (!produitId || !type || !quantite || !description) {
      return NextResponse.json({ error: "Champs obligatoires : produitId, type, quantite, description" }, { status: 400 });
    }

    if (!["MANQUANT", "SURPLUS", "DEFECTUEUX"].includes(type)) {
      return NextResponse.json({ error: "Type invalide" }, { status: 400 });
    }

    const produit = await prisma.produit.findUnique({ where: { id: Number(produitId) } });
    if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

    const anomalie = await prisma.$transaction(async (tx) => {
      const a = await tx.anomalieStock.create({
        data: {
          reference:   `ANO-${randomUUID().slice(0, 8).toUpperCase()}`,
          produitId:   Number(produitId),
          type:        type as TypeAnomalie,
          quantite:    Number(quantite),
          description,
          signalePar:  parseInt(session.user.id),
        },
        include: {
          produit:    { select: { id: true, nom: true } },
          magasinier: { select: { nom: true, prenom: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          userId:   parseInt(session.user.id),
          action:   "ANOMALIE_STOCK_SIGNALEE",
          entite:   "AnomalieStock",
          entiteId: a.id,
        },
      });

      const typeLabel: Record<string, string> = {
        MANQUANT:   "Manquant",
        SURPLUS:    "Surplus",
        DEFECTUEUX: "Produit défectueux",
      };

      await notifyRoles(
        tx,
        ["RESPONSABLE_POINT_DE_VENTE", "COMPTABLE"],
        {
          titre:    `Anomalie stock : ${typeLabel[type]} — ${produit.nom}`,
          message:  `${session.user.prenom} ${session.user.nom} a signalé une anomalie (${typeLabel[type]}) sur "${produit.nom}" : quantité ${quantite}. ${description}`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl: `/dashboard/admin/stock`,
        }
      );

      return a;
    });

    return NextResponse.json({ data: anomalie }, { status: 201 });
  } catch (error) {
    console.error("POST /magasinier/anomalies:", error);
    return NextResponse.json({ error: "Erreur lors de la creation" }, { status: 500 });
  }
}
