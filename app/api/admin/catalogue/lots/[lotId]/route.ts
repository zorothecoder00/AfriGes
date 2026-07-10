import { NextResponse } from "next/server";
import { StatutLot } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ lotId: string }> };

/**
 * Lot (Catalogue Ent.#5) — admin.
 * PATCH  — ajuste la quantité (mouvement AJUSTEMENT) et/ou les dates/notes.
 * DELETE — retire le lot de la vente (statut RETIRE, mouvement RETRAIT) — pas de
 *          suppression physique (conservation de la traçabilité).
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const lotId = Number((await params).lotId);
  if (!lotId) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });
  const lot = await prisma.lotProduit.findUnique({ where: { id: lotId }, select: { id: true, quantite: true, statut: true } });
  if (!lot) return NextResponse.json({ message: "Lot introuvable" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "Corps invalide" }, { status: 400 });

  const userId = Number(session.user.id);
  const data: Record<string, unknown> = {};

  if (body.dlc !== undefined) data.dlc = body.dlc ? new Date(body.dlc as string) : null;
  if (body.dluo !== undefined) data.dluo = body.dluo ? new Date(body.dluo as string) : null;
  if (body.notes !== undefined) data.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
  if (typeof body.statut === "string" && (["ACTIF", "EPUISE", "PERIME", "RETIRE"] as StatutLot[]).includes(body.statut as StatutLot)) {
    data.statut = body.statut;
  }

  // Ajustement de quantité (nouvelle quantité absolue).
  const nouvelleQte = body.quantite != null && body.quantite !== "" ? Number(body.quantite) : undefined;
  if (nouvelleQte !== undefined && (!Number.isInteger(nouvelleQte) || nouvelleQte < 0)) {
    return NextResponse.json({ message: "Quantité invalide" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (nouvelleQte !== undefined && nouvelleQte !== lot.quantite) {
      const delta = nouvelleQte - lot.quantite;
      data.quantite = nouvelleQte;
      if (nouvelleQte === 0 && !data.statut) data.statut = "EPUISE";
      await tx.mouvementLot.create({
        data: { lotId, type: "AJUSTEMENT", quantite: Math.abs(delta), motif: typeof body.motif === "string" ? body.motif : `Ajustement (${delta > 0 ? "+" : ""}${delta})`, operateurId: userId },
      });
    }
    const l = await tx.lotProduit.update({ where: { id: lotId }, data, select: { id: true, quantite: true, statut: true } });
    await auditLog(tx, userId, "LOT_MODIFIE", "LotProduit", lotId);
    return l;
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const lotId = Number((await params).lotId);
  if (!lotId) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });
  const lot = await prisma.lotProduit.findUnique({ where: { id: lotId }, select: { id: true, quantite: true } });
  if (!lot) return NextResponse.json({ message: "Lot introuvable" }, { status: 404 });

  const userId = Number(session.user.id);
  const url = new URL(req.url);
  const motif = url.searchParams.get("motif") || "Retrait manuel";

  await prisma.$transaction(async (tx) => {
    await tx.lotProduit.update({ where: { id: lotId }, data: { statut: "RETIRE" } });
    if (lot.quantite > 0) {
      await tx.mouvementLot.create({ data: { lotId, type: "RETRAIT", quantite: lot.quantite, motif, operateurId: userId } });
    }
    await auditLog(tx, userId, "LOT_RETIRE", "LotProduit", lotId);
  });

  return NextResponse.json({ ok: true });
}
