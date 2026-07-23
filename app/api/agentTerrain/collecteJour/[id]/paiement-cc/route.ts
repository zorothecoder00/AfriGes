import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { getCompteCourantParClient, montantBloqueActif } from "@/lib/compteCourant";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/agentTerrain/collecteJour/[id]/paiement-cc
 * Demande de paiement d'un crédit via le compte courant du client, initiée par
 * un agent terrain pendant sa session de collecte. Contrairement aux
 * encaissements espèces (packs/crédits, appliqués instantanément), ce paiement
 * reste EN_ATTENTE_CAISSIER : le compte n'est débité et le crédit remboursé
 * qu'à la confirmation du caissier (voir
 * app/api/caissier/remboursements/[id]/confirmer/route.ts). Le montant est
 * réservé dès cette demande (cf. montantBloqueActif) pour garantir sa
 * disponibilité à la confirmation.
 * Route dédiée à l'agent terrain — ne passe pas par la capacité CC générale
 * "DEPOSIT" (l'agent reste en lecture seule sur le module Compte Courant
 * partout ailleurs).
 * Body: { clientId, creditId, montant, observation? }
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const collecteId = parseInt(id);
    const agentId = parseInt(session.user.id);
    const agentNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();

    const body = await req.json();
    const { clientId, creditId, montant, observation } = body as {
      clientId?: number; creditId?: number; montant?: number; observation?: string;
    };
    if (!clientId || !creditId) return NextResponse.json({ error: "clientId et creditId requis" }, { status: 400 });
    const montantNum = Number(montant);
    if (!montantNum || montantNum <= 0) return NextResponse.json({ error: "montant requis et > 0" }, { status: 400 });

    const collecte = await prisma.collecteJournaliere.findUnique({ where: { id: collecteId } });
    if (!collecte) return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
    if (collecte.agentId !== agentId) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    if (collecte.statut !== "EN_COURS") return NextResponse.json({ error: "Session non active" }, { status: 400 });

    const client = await prisma.client.findUnique({
      where: { id: parseInt(String(clientId)) },
      select: { agentTerrainId: true, nom: true, prenom: true },
    });
    if (!client || client.agentTerrainId !== agentId) {
      return NextResponse.json({ error: "Client non assigné à cet agent" }, { status: 403 });
    }

    const credit = await prisma.creditClient.findUnique({
      where: { id: parseInt(String(creditId)) },
      select: { id: true, reference: true, clientId: true, statut: true, soldeRestant: true },
    });
    if (!credit || credit.clientId !== parseInt(String(clientId))) {
      return NextResponse.json({ error: "Crédit introuvable ou non rattaché à ce client" }, { status: 404 });
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

    const compte = await getCompteCourantParClient(parseInt(String(clientId)));
    if (!compte) return NextResponse.json({ error: "Ce client n'a pas de compte courant" }, { status: 422 });
    if (compte.statut !== "ACTIF") {
      return NextResponse.json({ error: `Compte ${compte.statut.toLowerCase()} : paiement impossible` }, { status: 422 });
    }

    const clientNom = `${compte.client.prenom} ${compte.client.nom}`;

    const result = await prisma.$transaction(async (tx) => {
      // Réserve le montant : le solde disponible doit couvrir la demande en
      // tenant compte des réservations déjà en cours (épargne bloquée + autres
      // paiements CC déjà en attente sur ce compte).
      const bloque = await montantBloqueActif(tx, compte.id);
      const disponible = Number(compte.solde) - bloque;
      if (montantNum > disponible) {
        throw Object.assign(
          new Error(`Solde disponible insuffisant : ${disponible.toLocaleString("fr-FR")} FCFA (dont réservations en cours).`),
          { status: 422 }
        );
      }

      const remboursement = await tx.remboursementCredit.create({
        data: {
          creditId: credit.id,
          montant: montantNum,
          modePaiement: "WALLET_GENERAL",
          statut: "EN_ATTENTE_CAISSIER",
          enregistreParId: agentId,
          agentCollecteurId: agentId,
          compteCourantId: compte.id,
          notes: observation ?? `Paiement CC — session ${collecte.reference} — ${agentNom}`,
        },
      });

      // Ligne d'activité de la session — en attente tant que le caissier n'a
      // pas confirmé (montant réel collecté = 0 jusque-là).
      const ligne = await tx.ligneCollecte.create({
        data: {
          collecteId,
          clientId: parseInt(String(clientId)),
          type: "CC",
          creditId: credit.id,
          remboursementCreditId: remboursement.id,
          montantAttendu: montantNum,
          montantCollecte: 0,
          statut: "EN_ATTENTE",
          modePaiement: "CC",
          notes: observation ?? null,
        },
      });

      await auditLog(tx, agentId, "PAIEMENT_CC_SESSION_EN_ATTENTE", "RemboursementCredit", remboursement.id);

      await notifyRoles(tx, ["CHEF_AGENCE", "CAISSIER"], {
        titre: `Paiement CC à confirmer — ${credit.reference}`,
        message: `${agentNom} demande le paiement de ${montantNum.toLocaleString("fr-FR")} FCFA du crédit ${credit.reference} via le compte courant de ${clientNom} (session ${collecte.reference}). En attente de confirmation caissier.`,
        priorite: "NORMAL",
        actionUrl: "/dashboard/user/caissiers",
      });

      return { remboursementId: remboursement.id, ligneId: ligne.id, montant: montantNum };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    if (status === 500) console.error("POST /api/agentTerrain/collecteJour/[id]/paiement-cc", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status });
  }
}
