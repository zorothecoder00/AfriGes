import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { notifyAdmins } from "@/lib/notifications";
import { validerNumeroJour, montantAttenduDuJour, parseDateCollecte } from "@/lib/remboursementCredit";

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
    const { montant, modePaiement = "ESPECES", notes, observation, numeroJour, agentCollecteurId, dateCollecte } = body;

    if (!montant || parseFloat(montant) <= 0) {
      return NextResponse.json({ error: "Montant requis > 0" }, { status: 400 });
    }

    const numeroJourNum = numeroJour != null && numeroJour !== "" ? parseInt(String(numeroJour)) : null;

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

    const erreurJour = validerNumeroJour(numeroJourNum, credit.dureeJours);
    if (erreurJour) return NextResponse.json({ error: erreurJour }, { status: 400 });

    const montantNum = parseFloat(montant);
    if (montantNum > Number(credit.soldeRestant) + 0.01) {
      return NextResponse.json(
        { error: `Montant trop élevé. Solde restant : ${Number(credit.soldeRestant).toLocaleString("fr-FR")} FCFA` },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Créer le remboursement EN_ATTENTE_CAISSIER — effet financier appliqué par le caissier
      const montantAttendu = await montantAttenduDuJour(tx, creditId, numeroJourNum);
      const remboursement = await tx.remboursementCredit.create({
        data: {
          creditId,
          montant: montantNum,
          modePaiement: modePaiement as "ESPECES" | "MOBILE_MONEY" | "VIREMENT" | "CHEQUE",
          statut: "EN_ATTENTE_CAISSIER",
          enregistreParId: agentId,
          // Agent collecteur = l'agent de terrain lui-même par défaut
          agentCollecteurId: agentCollecteurId ? parseInt(String(agentCollecteurId)) : agentId,
          numeroJour: numeroJourNum,
          montantAttendu,
          dateRemboursement: parseDateCollecte(dateCollecte) ?? new Date(),
          notes: (observation ?? notes) || `Remboursement terrain — ${agentNom}`,
        },
      });

      // 2. Audit + notification
      await tx.auditLog.create({
        data: {
          userId: agentId,
          action: "REMBOURSEMENT_CREDIT_TERRAIN_EN_ATTENTE",
          entite: "RemboursementCredit",
          entiteId: remboursement.id,
        },
      });

      const clientNom = credit.client
        ? `${credit.client.prenom} ${credit.client.nom}`
        : "—";
      await notifyAdmins(tx, {
        titre: `Remboursement crédit à confirmer — ${credit.reference}`,
        message: `${agentNom} a collecté ${montantNum.toLocaleString("fr-FR")} FCFA de ${clientNom} (${credit.reference}). En attente de confirmation caissier.`,
        priorite: "NORMAL",
        actionUrl: "/dashboard/user/caissiers",
      });

      return remboursement;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/agentTerrain/credits/[id]/rembourser", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
