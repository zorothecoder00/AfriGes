import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCorrectionCreditSession, creditDansPerimetre } from "@/lib/authRVC";
import { modifierRemboursementCredit, supprimerRemboursementCredit } from "@/lib/remboursementCredit";
import { notifyAdmins } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string; rembId: string }> };

/**
 * Charge le remboursement et vérifie : appartenance au crédit de l'URL + périmètre
 * PDV de l'appelant (RPV limité à son point de vente ; Admin/RVC sans limite).
 */
async function chargerRemboursement(id: string, rembId: string, pdvIds: number[] | null) {
  const creditId = Number(id);
  const remboursementId = Number(rembId);
  if (isNaN(creditId) || isNaN(remboursementId)) {
    return { error: NextResponse.json({ error: "ID invalide" }, { status: 400 }) };
  }
  const remb = await prisma.remboursementCredit.findUnique({
    where: { id: remboursementId },
    select: {
      creditId: true, montant: true,
      credit: { select: { reference: true, pointDeVenteId: true, client: { select: { nom: true, prenom: true } } } },
    },
  });
  if (!remb || remb.creditId !== creditId) {
    return { error: NextResponse.json({ error: "Remboursement introuvable" }, { status: 404 }) };
  }
  if (!creditDansPerimetre(pdvIds, remb.credit.pointDeVenteId)) {
    return { error: NextResponse.json({ error: "Ce crédit n'appartient pas à votre point de vente" }, { status: 403 }) };
  }
  return { remboursementId, remb };
}

/**
 * PATCH /api/admin/credits/[id]/remboursements/[rembId]
 * Corrige un remboursement de crédit (Admin / RVC / RPV de l'agence).
 *
 * Body: { montant?, dateCollecte?, numeroJour?, agentCollecteurId?, observation? }
 *
 * Un remboursement CONFIRME déclenche un recalcul financier complet
 * (échéancier, crédit, solde client, recouvrement RIA). Cf. modifierRemboursementCredit.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const acces = await getCorrectionCreditSession();
    if (!acces) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, rembId } = await params;
    const charge = await chargerRemboursement(id, rembId, acces.pdvIds);
    if ("error" in charge) return charge.error;

    const body = await req.json();
    const result = await modifierRemboursementCredit({
      remboursementId:   charge.remboursementId,
      nouveauMontant:    body.montant,
      dateCollecte:      body.dateCollecte,
      numeroJour:        body.numeroJour,
      agentCollecteurId: body.agentCollecteurId != null && body.agentCollecteurId !== ""
        ? parseInt(String(body.agentCollecteurId))
        : body.agentCollecteurId,
      observation:       body.observation ?? body.notes,
      userId:            parseInt(acces.session.user.id),
    });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("PATCH /api/admin/credits/[id]/remboursements/[rembId]", error);
    return NextResponse.json({ error: "Erreur lors de la modification du remboursement" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/credits/[id]/remboursements/[rembId]
 * Supprime un remboursement enregistré par erreur (Admin / RVC / RPV de l'agence).
 *
 * Réversion complète si CONFIRME : recouvrement RIA annulé, échéancier réimputé
 * (rouvre un crédit SOLDE), solde client recrédité. Bloqué si lié à une collecte
 * terrain ou à un paiement compte courant. Cf. supprimerRemboursementCredit.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const acces = await getCorrectionCreditSession();
    if (!acces) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, rembId } = await params;
    const charge = await chargerRemboursement(id, rembId, acces.pdvIds);
    if ("error" in charge) return charge.error;
    const { remb } = charge;

    const userId = parseInt(acces.session.user.id);
    const result = await supprimerRemboursementCredit({ remboursementId: charge.remboursementId, userId });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    const auteur = `${acces.session.user.prenom ?? ""} ${acces.session.user.nom ?? ""}`.trim();
    const clientNom = `${remb.credit.client.prenom} ${remb.credit.client.nom}`;
    await prisma.$transaction(async (tx) => {
      await notifyAdmins(tx, {
        titre: `Remboursement crédit supprimé — ${remb.credit.reference}`,
        message: `${auteur} a supprimé un remboursement de ${Number(remb.montant).toLocaleString("fr-FR")} FCFA de ${clientNom} (${remb.credit.reference}) — erreur de saisie.`,
        priorite: "HAUTE",
        actionUrl: "/dashboard/admin/credits",
      });
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("DELETE /api/admin/credits/[id]/remboursements/[rembId]", error);
    return NextResponse.json({ error: "Erreur lors de la suppression du remboursement" }, { status: 500 });
  }
}
