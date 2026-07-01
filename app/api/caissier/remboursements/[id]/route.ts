import { NextResponse } from "next/server";
import { getCaissierSession, getCaissierPdvId } from "@/lib/authCaissier";
import { modifierRemboursementCredit } from "@/lib/remboursementCredit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/caissier/remboursements/[id]
 * Corrige un remboursement de crédit encaissé au comptoir (scoped au PDV du caissier).
 *
 * Body: { montant?, dateCollecte?, numeroJour?, agentCollecteurId?, observation? }
 *
 * Le montant est désormais modifiable : un remboursement CONFIRME déclenche un
 * recalcul financier complet (échéancier, crédit, solde client, recouvrement RIA).
 * Cf. modifierRemboursementCredit.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const remboursementId = parseInt(id);
    if (isNaN(remboursementId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId   = isAdmin ? null : await getCaissierPdvId(userId);

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
      userId,
      pdvId,
    });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("PATCH /api/caissier/remboursements/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
