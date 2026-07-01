import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { modifierRemboursementCredit } from "@/lib/remboursementCredit";

type Ctx = { params: Promise<{ id: string; rembId: string }> };

/**
 * PATCH /api/admin/credits/[id]/remboursements/[rembId]
 * Corrige un remboursement de crédit (Admin / RVC).
 *
 * Body: { montant?, dateCollecte?, numeroJour?, agentCollecteurId?, observation? }
 *
 * Un remboursement CONFIRME déclenche un recalcul financier complet
 * (échéancier, crédit, solde client, recouvrement RIA). Cf. modifierRemboursementCredit.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, rembId } = await params;
    const creditId = Number(id);
    const remboursementId = Number(rembId);
    if (isNaN(creditId) || isNaN(remboursementId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    // Intégrité de l'URL : le remboursement doit appartenir au crédit ciblé.
    const remb = await prisma.remboursementCredit.findUnique({
      where: { id: remboursementId },
      select: { creditId: true },
    });
    if (!remb || remb.creditId !== creditId) {
      return NextResponse.json({ error: "Remboursement introuvable" }, { status: 404 });
    }

    const body = await req.json();
    const result = await modifierRemboursementCredit({
      remboursementId,
      nouveauMontant:    body.montant,
      dateCollecte:      body.dateCollecte,
      numeroJour:        body.numeroJour,
      agentCollecteurId: body.agentCollecteurId != null && body.agentCollecteurId !== ""
        ? parseInt(String(body.agentCollecteurId))
        : body.agentCollecteurId,
      observation:       body.observation ?? body.notes,
      userId:            parseInt(session.user.id),
    });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("PATCH /api/admin/credits/[id]/remboursements/[rembId]", error);
    return NextResponse.json({ error: "Erreur lors de la modification du remboursement" }, { status: 500 });
  }
}
