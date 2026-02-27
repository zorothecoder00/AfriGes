import { NextResponse } from "next/server";
import { Prisma, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCaissierSession } from "@/lib/authCaissier";
import { notifyAdmins, auditLog } from "@/lib/notifications";

function genRef(prefix: string): string {
  const d   = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${ymd}-${rand}`;
}

/**
 * GET /api/caissier/operations
 * Params: sessionId?, type?, page?, limit?
 */
export async function GET(req: Request) {
  try {
    const auth = await getCaissierSession();
    if (!auth) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId") ? parseInt(searchParams.get("sessionId")!) : undefined;
    const type      = searchParams.get("type") as "ENCAISSEMENT" | "DECAISSEMENT" | null;
    const page      = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit     = Math.min(50, parseInt(searchParams.get("limit") ?? "20"));

    const where: Record<string, unknown> = {};
    if (sessionId) where.sessionId = sessionId;
    if (type)      where.type      = type;

    const [operations, total] = await Promise.all([
      prisma.operationCaisse.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      prisma.operationCaisse.count({ where }),
    ]);

    // Totaux du jour pour la session courante
    const now        = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const todayWhere: Record<string, unknown> = { createdAt: { gte: startOfDay, lte: endOfDay } };
    if (sessionId) todayWhere.sessionId = sessionId;

    const [totalEncaissDuJour, totalDecaissDuJour] = await Promise.all([
      prisma.operationCaisse.aggregate({
        _sum: { montant: true },
        where: { ...todayWhere, type: "ENCAISSEMENT" },
      }),
      prisma.operationCaisse.aggregate({
        _sum: { montant: true },
        where: { ...todayWhere, type: "DECAISSEMENT" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: operations.map((op) => ({
        ...op,
        montant:   Number(op.montant),
        createdAt: op.createdAt.toISOString(),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      totalsJour: {
        encaissements: Number(totalEncaissDuJour._sum.montant ?? 0),
        decaissements: Number(totalDecaissDuJour._sum.montant ?? 0),
      },
    });
  } catch (error) {
    console.error("GET /api/caissier/operations error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/caissier/operations
 * Body: { type, mode?, categorie?, montant, motif }
 */
export async function POST(req: Request) {
  try {
    const auth = await getCaissierSession();
    if (!auth) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { type, mode, categorie, motif } = body;
    const montant = Number(body.montant);

    if (!["ENCAISSEMENT", "DECAISSEMENT"].includes(type)) {
      return NextResponse.json({ message: "Type invalide" }, { status: 400 });
    }
    if (!montant || montant <= 0) {
      return NextResponse.json({ message: "Montant invalide" }, { status: 400 });
    }
    if (!motif || typeof motif !== "string" || !motif.trim()) {
      return NextResponse.json({ message: "Motif requis" }, { status: 400 });
    }
    if (type === "ENCAISSEMENT" && !["ESPECES", "VIREMENT", "CHEQUE"].includes(mode)) {
      return NextResponse.json({ message: "Mode de paiement invalide" }, { status: 400 });
    }
    if (type === "DECAISSEMENT" && !["SALAIRE", "AVANCE", "FOURNISSEUR", "AUTRE"].includes(categorie)) {
      return NextResponse.json({ message: "Catégorie invalide" }, { status: 400 });
    }

    // Récupère la session active
    const sessionActive = await prisma.sessionCaisse.findFirst({
      where: { statut: { in: ["OUVERTE", "SUSPENDUE"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!sessionActive) {
      return NextResponse.json({ message: "Aucune session de caisse ouverte. Ouvrez d'abord la caisse." }, { status: 409 });
    }

    const prefix = type === "ENCAISSEMENT" ? "ENC" : "DEC";
    const operateurNom = auth.user.name ?? `${auth.user.prenom} ${auth.user.nom}`;
    const operateurId  = parseInt(auth.user.id);

    const operation = await prisma.$transaction(async (tx) => {
      const op = await tx.operationCaisse.create({
        data: {
          sessionId:    sessionActive.id,
          type,
          mode:         type === "ENCAISSEMENT" ? mode : null,
          categorie:    type === "DECAISSEMENT" ? categorie : null,
          montant:      new Prisma.Decimal(montant),
          motif:        motif.trim(),
          reference:    genRef(prefix),
          operateurNom,
          operateurId,
        },
      });

      await auditLog(tx, operateurId, `${type}_CAISSE`, "OperationCaisse", op.id);

      // Notifier l'admin pour les décaissements
      if (type === "DECAISSEMENT") {
        await notifyAdmins(tx, {
          titre:    `Décaissement caisse — ${categorie}`,
          message:  `${operateurNom} a effectué un décaissement de ${montant.toLocaleString("fr-FR")} FCFA. Motif : ${motif.trim()}.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: "/dashboard/user/caissiers",
        });
      }

      return op;
    });

    return NextResponse.json(
      {
        success: true,
        message: type === "ENCAISSEMENT" ? "Encaissement enregistré" : "Décaissement enregistré",
        data: {
          ...operation,
          montant:   Number(operation.montant),
          createdAt: operation.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/caissier/operations error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
