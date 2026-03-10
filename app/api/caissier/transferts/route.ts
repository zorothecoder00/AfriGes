import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCaissierSession } from "@/lib/authCaissier";
import { auditLog } from "@/lib/notifications";

function genRef(): string {
  const d   = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TRF-${ymd}-${rand}`;
}

/**
 * GET /api/caissier/transferts
 * Params: sessionId?, page?, limit?
 */
export async function GET(req: Request) {
  try {
    const auth = await getCaissierSession();
    if (!auth) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId") ? parseInt(searchParams.get("sessionId")!) : undefined;
    const page      = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit     = Math.min(50, parseInt(searchParams.get("limit") ?? "20"));

    const userId  = parseInt(auth.user.id);
    const isAdmin = auth.user.role === "ADMIN" || auth.user.role === "SUPER_ADMIN";
    const sessionScope = isAdmin ? {} : { session: { caissierId: userId } };

    const where: Record<string, unknown> = { ...sessionScope };
    if (sessionId) where.sessionId = sessionId;

    const [transferts, total] = await Promise.all([
      prisma.transfertCaisse.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      prisma.transfertCaisse.count({ where }),
    ]);

    // Total du jour pour le périmètre du caissier
    const now        = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const todayWhere: Record<string, unknown> = { ...sessionScope, createdAt: { gte: startOfDay, lte: endOfDay } };
    if (sessionId) todayWhere.sessionId = sessionId;

    const totalJour = await prisma.transfertCaisse.aggregate({
      _sum: { montant: true },
      where: todayWhere,
    });

    return NextResponse.json({
      success: true,
      data: transferts.map((t) => ({
        ...t,
        montant:   Number(t.montant),
        createdAt: t.createdAt.toISOString(),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      totalJour: Number(totalJour._sum.montant ?? 0),
    });
  } catch (error) {
    console.error("GET /api/caissier/transferts error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/caissier/transferts
 * Body: { origine, destination, montant, motif? }
 */
export async function POST(req: Request) {
  try {
    const auth = await getCaissierSession();
    if (!auth) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { origine, destination, motif } = body;
    const montant = Number(body.montant);

    if (!origine || typeof origine !== "string" || !origine.trim()) {
      return NextResponse.json({ message: "Origine requise" }, { status: 400 });
    }
    if (!destination || typeof destination !== "string" || !destination.trim()) {
      return NextResponse.json({ message: "Destination requise" }, { status: 400 });
    }
    if (!montant || montant <= 0) {
      return NextResponse.json({ message: "Montant invalide" }, { status: 400 });
    }

    const operateurId  = parseInt(auth.user.id);
    const isAdminPost  = auth.user.role === "ADMIN" || auth.user.role === "SUPER_ADMIN";

    const sessionActive = await prisma.sessionCaisse.findFirst({
      where: {
        statut: { in: ["OUVERTE", "SUSPENDUE"] },
        ...(isAdminPost ? {} : { caissierId: operateurId }),
      },
      orderBy: { createdAt: "desc" },
    });
    if (!sessionActive) {
      return NextResponse.json({ message: "Aucune session de caisse ouverte" }, { status: 409 });
    }

    const operateurNom = auth.user.name ?? `${auth.user.prenom} ${auth.user.nom}`;

    const transfert = await prisma.$transaction(async (tx) => {
      const t = await tx.transfertCaisse.create({
        data: {
          sessionId:   sessionActive.id,
          origine:     origine.trim(),
          destination: destination.trim(),
          montant:     new Prisma.Decimal(montant),
          motif:       motif?.trim() || null,
          reference:   genRef(),
          operateurNom,
          operateurId,
        },
      });

      await auditLog(tx, operateurId, "TRANSFERT_CAISSE", "TransfertCaisse", t.id);
      return t;
    });

    return NextResponse.json(
      {
        success: true,
        message: "Transfert enregistré",
        data: {
          ...transfert,
          montant:   Number(transfert.montant),
          createdAt: transfert.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/caissier/transferts error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
