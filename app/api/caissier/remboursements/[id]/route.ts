import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCaissierSession, getCaissierPdvId } from "@/lib/authCaissier";
import { validerNumeroJour, montantAttenduDuJour, parseDateCollecte } from "@/lib/remboursementCredit";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/caissier/remboursements/[id]
 * Corrige les infos NON financières d'un remboursement de crédit (comme la
 * correction d'un versement de pack) : date de collecte, N° de jour, agent
 * collecteur, observation. Le montant n'est pas modifiable ici (effet financier).
 * Body: { dateCollecte?, numeroJour?, agentCollecteurId?, observation? }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const remboursementId = parseInt(id);
    if (isNaN(remboursementId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const userId = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId = isAdmin ? null : await getCaissierPdvId(userId);

    const remboursement = await prisma.remboursementCredit.findUnique({
      where: { id: remboursementId },
      select: { id: true, creditId: true, credit: { select: { dureeJours: true, client: { select: { pointDeVenteId: true } } } } },
    });
    if (!remboursement) return NextResponse.json({ error: "Remboursement introuvable" }, { status: 404 });
    if (pdvId !== null && remboursement.credit.client.pointDeVenteId !== pdvId) {
      return NextResponse.json({ error: "Ce remboursement n'appartient pas à votre point de vente" }, { status: 403 });
    }

    const body = await req.json();
    const { dateCollecte, numeroJour, agentCollecteurId, observation } = body;
    const numeroJourNum = numeroJour != null && numeroJour !== "" ? parseInt(String(numeroJour)) : null;

    const erreurJour = validerNumeroJour(numeroJourNum, remboursement.credit.dureeJours);
    if (erreurJour) return NextResponse.json({ error: erreurJour }, { status: 400 });

    const data: Record<string, unknown> = {};
    if (dateCollecte !== undefined) {
      const d = parseDateCollecte(dateCollecte);
      if (d) data.dateRemboursement = d;
    }
    if (numeroJour !== undefined) {
      data.numeroJour = numeroJourNum;
      // Montant attendu recalculé sur la nouvelle échéance du jour
      data.montantAttendu = await montantAttenduDuJour(prisma, remboursement.creditId, numeroJourNum);
    }
    if (agentCollecteurId !== undefined) data.agentCollecteurId = agentCollecteurId ? parseInt(String(agentCollecteurId)) : null;
    if (observation !== undefined) data.notes = observation || null;

    const updated = await prisma.remboursementCredit.update({ where: { id: remboursementId }, data });
    await auditLog(prisma, userId, "CORRECTION_REMBOURSEMENT_CREDIT", "RemboursementCredit", remboursementId);

    return NextResponse.json({ data: { id: updated.id } });
  } catch (error) {
    console.error("PATCH /api/caissier/remboursements/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
