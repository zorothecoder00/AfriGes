import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCaissierSession, getCaissierPdvId } from "@/lib/authCaissier";
import { modifierRemboursementCredit, supprimerRemboursementCredit } from "@/lib/remboursementCredit";
import { notifyAdmins } from "@/lib/notifications";

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

/**
 * DELETE /api/caissier/remboursements/[id]
 * Supprime un remboursement de crédit encaissé par erreur (scoped au PDV du caissier).
 *
 * Réversion complète si le remboursement était CONFIRME : recouvrement RIA annulé,
 * échéancier du crédit réimputé (peut rouvrir un crédit SOLDE), solde client
 * recrédité. Bloqué si lié à une collecte terrain ou à un paiement compte courant.
 * Cf. supprimerRemboursementCredit.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const remboursementId = parseInt(id);
    if (isNaN(remboursementId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId   = isAdmin ? null : await getCaissierPdvId(userId);

    // Contexte pour la notification admin (récupéré avant suppression).
    const remb = await prisma.remboursementCredit.findUnique({
      where: { id: remboursementId },
      select: {
        montant: true,
        credit: { select: { reference: true, client: { select: { nom: true, prenom: true } } } },
      },
    });

    const result = await supprimerRemboursementCredit({ remboursementId, userId, pdvId });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    if (remb) {
      const caissierNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();
      const clientNom = `${remb.credit.client.prenom} ${remb.credit.client.nom}`;
      await prisma.$transaction(async (tx) => {
        await notifyAdmins(tx, {
          titre: `Remboursement crédit supprimé — ${remb.credit.reference}`,
          message: `${caissierNom} a supprimé un remboursement de ${Number(remb.montant).toLocaleString("fr-FR")} FCFA de ${clientNom} (${remb.credit.reference}) — erreur de saisie.`,
          priorite: "HAUTE",
          actionUrl: "/dashboard/admin/credits",
        });
      });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("DELETE /api/caissier/remboursements/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
