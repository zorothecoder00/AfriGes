import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPOPCSession } from "@/lib/popc/authPOPC";
import { auditLog } from "@/lib/notifications";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/popc/parametrage/[id]/valider
 * Fige les objectifs du mois (statut VALIDE). Réservé aux profils `valider`
 * (Direction Générale, Directeur Commercial, Comptabilité — CDC §14).
 */
export async function POST(_req: Request, { params }: Ctx) {
  const ctx = await getPOPCSession();
  if (!ctx || !ctx.capacites.valider) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const paramId = Number(id);
  if (!Number.isInteger(paramId)) {
    return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  }

  const existant = await prisma.parametragePOPC.findUnique({
    where: { id: paramId }, include: { objectif: true },
  });
  if (!existant) return NextResponse.json({ error: "Paramétrage introuvable" }, { status: 404 });
  if (!existant.objectif) {
    return NextResponse.json({ error: "Aucun objectif généré à valider" }, { status: 422 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.parametragePOPC.update({
      where: { id: paramId },
      data: { statut: "VALIDE", valideParId: ctx.userId, dateValidation: new Date() },
    });
    await auditLog(tx, ctx.userId, "POPC_OBJECTIFS_VALIDES", "ParametragePOPC", paramId);
  });

  return NextResponse.json({ data: { id: paramId, statut: "VALIDE" } });
}
