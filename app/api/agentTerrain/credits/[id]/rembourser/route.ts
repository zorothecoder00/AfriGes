import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { auditLog, notifyAdmins } from "@/lib/notifications";
import { validerNumeroJour, parseDateCollecte, enregistrerRemboursementCredit } from "@/lib/remboursementCredit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/agentTerrain/credits/[id]/rembourser
 * Remboursement standalone (hors session de collecte).
 * Body: { montant, modePaiement?, notes? }
 * Effet financier immédiat (échéances, solde, cascade RIA) — l'agent collecte
 * directement, le contrôle se fait a posteriori (audit + fraude sur la session).
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
      const out = await enregistrerRemboursementCredit(tx, {
        creditId,
        montant: montantNum,
        numeroJour: numeroJourNum,
        observation: (observation ?? notes) || `Remboursement terrain — ${agentNom}`,
        modePaiement: modePaiement as "ESPECES" | "MOBILE_MONEY" | "VIREMENT" | "CHEQUE",
        enregistreParId: agentId,
        agentCollecteurId: agentCollecteurId ? parseInt(String(agentCollecteurId)) : agentId,
        dateCollecte: parseDateCollecte(dateCollecte),
        confirmer: true,
      });
      if (!out.ok) throw Object.assign(new Error(out.error), { status: 400 });

      await auditLog(tx, agentId, "REMBOURSEMENT_CREDIT_TERRAIN_CONFIRME", "RemboursementCredit", out.remboursementId);

      const clientNom = credit.client
        ? `${credit.client.prenom} ${credit.client.nom}`
        : "—";
      await notifyAdmins(tx, {
        titre: `Remboursement crédit collecté — ${credit.reference}`,
        message: `${agentNom} a collecté ${montantNum.toLocaleString("fr-FR")} FCFA de ${clientNom} (${credit.reference}).`,
        priorite: "NORMAL",
        actionUrl: "/dashboard/admin/credits",
      });

      return out;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    if (status === 500) console.error("POST /api/agentTerrain/credits/[id]/rembourser", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status });
  }
}
