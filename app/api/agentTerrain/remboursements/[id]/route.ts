import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { modifierRemboursementCredit } from "@/lib/remboursementCredit";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/agentTerrain/remboursements/[id]
 * Corrige un remboursement de crédit collecté par l'agent terrain (client
 * assigné uniquement). Même garde/recalcul que caissier et RVC — cf.
 * modifierRemboursementCredit (refuse un remboursement REJETE ou un crédit
 * ANNULE/REJETE).
 *
 * Body: { montant?, dateCollecte?, numeroJour?, observation? }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const remboursementId = parseInt(id);
    if (isNaN(remboursementId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const agentId = parseInt(session.user.id);

    const remb = await prisma.remboursementCredit.findUnique({
      where: { id: remboursementId },
      include: { credit: { select: { client: { select: { agentTerrainId: true } } } } },
    });
    if (!remb) return NextResponse.json({ error: "Remboursement introuvable" }, { status: 404 });
    if (remb.credit.client?.agentTerrainId !== agentId) {
      return NextResponse.json({ error: "Accès refusé : client non assigné" }, { status: 403 });
    }

    const body = await req.json();
    const result = await modifierRemboursementCredit({
      remboursementId,
      nouveauMontant: body.montant,
      dateCollecte:   body.dateCollecte,
      numeroJour:     body.numeroJour,
      observation:    body.observation ?? body.notes,
      userId:         agentId,
    });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    await auditLog(prisma, agentId, "REMBOURSEMENT_CREDIT_TERRAIN_CORRIGE", "RemboursementCredit", remboursementId);

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("PATCH /api/agentTerrain/remboursements/[id]", error);
    return NextResponse.json({ error: "Erreur lors de la modification du remboursement" }, { status: 500 });
  }
}
