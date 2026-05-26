import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { notifyAdmins } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/agentTerrain/credits/[id]/rembourser
 * Remboursement standalone (hors session de collecte).
 * Body: { montant, modePaiement?, notes? }
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const creditId = parseInt(id);
    const agentId = parseInt(session.user.id);
    const agentNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();

    const body = await req.json();
    const { montant, modePaiement = "ESPECES", notes } = body;

    if (!montant || parseFloat(montant) <= 0) {
      return NextResponse.json({ error: "Montant requis > 0" }, { status: 400 });
    }

    const credit = await prisma.creditClient.findUnique({
      where: { id: creditId },
      include: {
        client: { select: { nom: true, prenom: true, agentTerrainId: true } },
      },
    });

    if (!credit) return NextResponse.json({ error: "Crédit introuvable" }, { status: 404 });
    if (credit.client?.agentTerrainId !== agentId) {
      return NextResponse.json({ error: "Accès refusé : client non assigné" }, { status: 403 });
    }
    if (!["ACTIF", "EN_RETARD"].includes(credit.statut)) {
      return NextResponse.json({ error: "Crédit non actif" }, { status: 400 });
    }

    const montantNum = parseFloat(montant);
    if (montantNum > Number(credit.soldeRestant) + 0.01) {
      return NextResponse.json(
        { error: `Montant trop élevé. Solde restant : ${Number(credit.soldeRestant).toLocaleString("fr-FR")} FCFA` },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const nouveauSolde = Number(credit.soldeRestant) - montantNum;
      const estSolde = nouveauSolde <= 0.01;

      // 1. Créer le remboursement
      const remboursement = await tx.remboursementCredit.create({
        data: {
          creditId,
          montant: montantNum,
          modePaiement: "ESPECES",
          enregistreParId: agentId,
          notes: notes ?? `Remboursement terrain — ${agentNom}`,
        },
      });

      // 2. Mettre à jour les échéances
      const echeances = await tx.echeanceCredit.findMany({
        where: { creditId, statut: { in: ["EN_ATTENTE", "EN_RETARD"] } },
        orderBy: { dateEcheance: "asc" },
      });
      let budget = montantNum;
      for (const ec of echeances) {
        if (budget <= 0) break;
        const du = Number(ec.montantDu) - Number(ec.montantPaye);
        if (budget >= du - 0.01) {
          await tx.echeanceCredit.update({
            where: { id: ec.id },
            data: { statut: "PAYE", montantPaye: Number(ec.montantDu) },
          });
          budget -= du;
        } else {
          await tx.echeanceCredit.update({
            where: { id: ec.id },
            data: { statut: "PARTIEL", montantPaye: { increment: budget } },
          });
          budget = 0;
        }
      }

      // 3. Mettre à jour le crédit
      await tx.creditClient.update({
        where: { id: creditId },
        data: {
          montantRembourse: { increment: montantNum },
          soldeRestant: estSolde ? 0 : nouveauSolde,
          statut: estSolde ? "SOLDE" : credit.statut,
        },
      });

      // 4. Audit + notification
      await tx.auditLog.create({
        data: {
          userId: agentId,
          action: "REMBOURSEMENT_CREDIT_TERRAIN",
          entite: "RemboursementCredit",
          entiteId: remboursement.id,
        },
      });

      const clientNom = credit.client
        ? `${credit.client.prenom} ${credit.client.nom}`
        : "—";
      await notifyAdmins(tx, {
        titre: `Remboursement crédit — ${credit.reference}`,
        message: `${agentNom} a encaissé ${montantNum.toLocaleString("fr-FR")} FCFA de ${clientNom} (${credit.reference}). Solde restant : ${estSolde ? 0 : nouveauSolde.toLocaleString("fr-FR")} FCFA.`,
        priorite: estSolde ? "HAUTE" : "NORMAL",
        actionUrl: "/dashboard/admin/credits",
      });

      return remboursement;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/agentTerrain/credits/[id]/rembourser", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
