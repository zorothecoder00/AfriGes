import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { agentDepuisJetonScan, trouverOuCreerSessionDuJour } from "@/lib/collecteSession";
import { enregistrerRemboursementCredit } from "@/lib/remboursementCredit";
import { auditLog, notifyAdmins } from "@/lib/notifications";

type Ctx = { params: Promise<{ token: string }> };

/**
 * POST /api/agent-scan/[token]/encaisser  (PUBLIC — jeton opaque en guise d'authentification)
 * Encaisse en espèces un remboursement de crédit depuis la page scannée, sans
 * connexion. Effet financier immédiat (échéances, solde), comme depuis le
 * dashboard — rattaché à la session du jour de l'agent.
 * Body: { creditId, montant, notes? }
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { token } = await params;
    const agent = await agentDepuisJetonScan(token);
    if (!agent) return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 404 });

    const body = await req.json();
    const { creditId, montant, notes } = body as { creditId?: number; montant?: number; notes?: string };
    if (!creditId) return NextResponse.json({ error: "creditId requis" }, { status: 400 });
    const montantNum = Number(montant);
    if (!montantNum || montantNum <= 0) return NextResponse.json({ error: "montant requis et > 0" }, { status: 400 });

    const credit = await prisma.creditClient.findUnique({
      where: { id: parseInt(String(creditId)) },
      include: { client: { select: { nom: true, prenom: true, agentTerrainId: true } } },
    });
    if (!credit) return NextResponse.json({ error: "Crédit introuvable" }, { status: 404 });
    if (credit.client?.agentTerrainId !== agent.id) {
      return NextResponse.json({ error: "Client non assigné à cet agent" }, { status: 403 });
    }
    if (!["ACTIF", "EN_RETARD"].includes(credit.statut)) {
      return NextResponse.json({ error: "Crédit non actif" }, { status: 400 });
    }
    if (montantNum > Number(credit.soldeRestant) + 0.01) {
      return NextResponse.json(
        { error: `Montant trop élevé. Solde restant : ${Number(credit.soldeRestant).toLocaleString("fr-FR")} FCFA` },
        { status: 400 }
      );
    }

    const agentNom = `${agent.prenom} ${agent.nom}`;
    const collecte = await trouverOuCreerSessionDuJour(agent.id);

    const result = await prisma.$transaction(async (tx) => {
      const out = await enregistrerRemboursementCredit(tx, {
        creditId: credit.id,
        montant: montantNum,
        numeroJour: null,
        observation: notes ?? `Scan QR — session ${collecte.reference} — ${agentNom}`,
        enregistreParId: agent.id,
        agentCollecteurId: agent.id,
        confirmer: true,
      });
      if (!out.ok) throw Object.assign(new Error(out.error), { status: 400 });

      await tx.ligneCollecte.create({
        data: {
          collecteId: collecte.id,
          clientId: credit.clientId,
          type: "CREDIT",
          creditId: credit.id,
          montantAttendu: out.montantEffectif,
          montantCollecte: out.montantEffectif,
          statut: "COLLECTE",
          modePaiement: "ESPECES",
          notes: notes ?? null,
        },
      });

      await tx.collecteJournaliere.update({
        where: { id: collecte.id },
        data: { montantCollecte: { increment: out.montantEffectif } },
      });

      await auditLog(tx, agent.id, "REMBOURSEMENT_CREDIT_SCAN_CONFIRME", "RemboursementCredit", out.remboursementId);

      const clientNom = credit.client ? `${credit.client.prenom} ${credit.client.nom}` : "—";
      await notifyAdmins(tx, {
        titre: `Remboursement crédit — ${credit.reference}`,
        message: `${agentNom} a collecté ${out.montantEffectif.toLocaleString("fr-FR")} FCFA de ${clientNom} (${credit.reference}, via QR).`,
        priorite: "NORMAL",
        actionUrl: "/dashboard/admin/credits",
      });

      return out;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    if (status === 500) console.error("POST /api/agent-scan/[token]/encaisser", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status });
  }
}
