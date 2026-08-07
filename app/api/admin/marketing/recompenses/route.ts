import { NextRequest, NextResponse } from "next/server";
import { Prisma, TypeRecompense } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";

const TYPES: TypeRecompense[] = ["REDUCTION", "PRODUIT_GRATUIT", "CASHBACK"];

/**
 * Catalogue de récompenses fidélité (CDC §36) — réutilise le modèle
 * RecompenseFidelite existant (jusqu'ici orphelin, jamais branché).
 * GET  — liste du catalogue.
 * POST — crée une récompense.
 */
export async function GET() {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const recompenses = await prisma.recompenseFidelite.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        produit: { select: { id: true, nom: true } },
        _count: { select: { echanges: true } },
      },
    });

    return NextResponse.json({
      data: recompenses.map((r) => ({ ...r, valeur: r.valeur !== null ? Number(r.valeur) : null })),
    });
  } catch (e) {
    console.error("GET /api/admin/marketing/recompenses", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "CREATION");
    if (denied) return denied;

    const body = await req.json();
    const { nom, description, type, coutPoints, valeur, produitId, actif, dateExpiration } = body;

    if (!nom || !TYPES.includes(type)) return NextResponse.json({ error: "Nom et type (valide) sont requis" }, { status: 400 });
    const coutPointsNum = Number(coutPoints);
    if (!coutPointsNum || coutPointsNum <= 0) return NextResponse.json({ error: "Le coût en points doit être supérieur à 0" }, { status: 400 });

    const userId = Number(session.user.id);
    const recompense = await prisma.$transaction(async (tx) => {
      const r = await tx.recompenseFidelite.create({
        data: {
          nom, description: description || null, type: type as TypeRecompense,
          coutPoints: coutPointsNum,
          valeur: valeur != null && valeur !== "" ? new Prisma.Decimal(Number(valeur)) : null,
          produitId: produitId ? Number(produitId) : null,
          actif: actif === undefined ? true : Boolean(actif),
          dateExpiration: dateExpiration ? new Date(dateExpiration) : null,
        },
      });
      await auditLog(tx, userId, "RECOMPENSE_CREEE", "RecompenseFidelite", r.id);
      return r;
    });

    return NextResponse.json({ data: { ...recompense, valeur: recompense.valeur !== null ? Number(recompense.valeur) : null } }, { status: 201 });
  } catch (e) {
    console.error("POST /api/admin/marketing/recompenses", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
