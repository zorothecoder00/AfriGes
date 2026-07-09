import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { extraireMetaRequete } from "@/lib/compteCourant";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string; aid: string }> };

const autoSelect = {
  id: true, actif: true, montantMax: true, montantMinSolde: true,
  dernierPrelevementAt: true, totalPreleve: true, nbPrelevements: true, createdAt: true,
  credit: { select: { id: true, reference: true, statut: true, soldeRestant: true, montantTotal: true, montantJournalier: true } },
  creePar: { select: { nom: true, prenom: true } },
};

/**
 * PATCH  /api/comptes-courants/[id]/prelevements/[aid] — capacité CREATE
 *   action: "ACTIVER" | "DESACTIVER", ou édition montantMax / montantMinSolde.
 * DELETE /api/comptes-courants/[id]/prelevements/[aid] — capacité CREATE
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("CREATE");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id, aid } = await params;
  const compteId = Number(id);
  const autoId = Number(aid);
  if (!compteId || !autoId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const autorisation = await prisma.autorisationPrelevement.findFirst({
    where: { id: autoId, compteId }, select: { id: true },
  });
  if (!autorisation) return NextResponse.json({ error: "Autorisation introuvable" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : null;
  const data: Prisma.AutorisationPrelevementUpdateInput = {};
  let auditAction = "MODIFICATION_PRELEVEMENT_AUTO";

  if (action === "ACTIVER") { data.actif = true; auditAction = "ACTIVATION_PRELEVEMENT_AUTO"; }
  else if (action === "DESACTIVER") { data.actif = false; auditAction = "DESACTIVATION_PRELEVEMENT_AUTO"; }
  else {
    if (body?.montantMax !== undefined) {
      if (body.montantMax === null || body.montantMax === "") data.montantMax = null;
      else {
        const v = Number(body.montantMax);
        if (isNaN(v) || v < 0) return NextResponse.json({ error: "Plafond invalide" }, { status: 400 });
        data.montantMax = v;
      }
    }
    if (body?.montantMinSolde !== undefined) {
      if (body.montantMinSolde === null || body.montantMinSolde === "") data.montantMinSolde = null;
      else {
        const v = Number(body.montantMinSolde);
        if (isNaN(v) || v < 0) return NextResponse.json({ error: "Solde plancher invalide" }, { status: 400 });
        data.montantMinSolde = v;
      }
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
  }

  const userId = Number(session.user.id);
  const { ip, userAgent } = extraireMetaRequete(req);

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.autorisationPrelevement.update({ where: { id: autoId }, data, select: autoSelect });
    await auditLog(tx, userId, auditAction, "CompteCourant", compteId, undefined, { ip, userAgent });
    return u;
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("CREATE");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id, aid } = await params;
  const compteId = Number(id);
  const autoId = Number(aid);
  if (!compteId || !autoId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const autorisation = await prisma.autorisationPrelevement.findFirst({
    where: { id: autoId, compteId }, select: { id: true },
  });
  if (!autorisation) return NextResponse.json({ error: "Autorisation introuvable" }, { status: 404 });

  const userId = Number(session.user.id);
  const { ip, userAgent } = extraireMetaRequete(req);

  await prisma.$transaction(async (tx) => {
    await tx.autorisationPrelevement.delete({ where: { id: autoId } });
    await auditLog(tx, userId, "SUPPRESSION_PRELEVEMENT_AUTO", "CompteCourant", compteId, undefined, { ip, userAgent });
  });

  return NextResponse.json({ data: { id: autoId } });
}
