import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { notifyAdmins } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/agentTerrain/collecteJour/[id]/encaisser
 * Encaisse un paiement (pack ou crédit) dans la session de collecte du jour.
 * Body: { type: "PACK"|"CREDIT", souscriptionId?, creditId?, montant, modePaiement?, latitude?, longitude?, notes? }
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
    const { type, souscriptionId, creditId, montant, modePaiement = "ESPECES", latitude, longitude, notes } = body;

    if (!type || !["PACK", "CREDIT"].includes(type)) {
      return NextResponse.json({ error: "type requis : PACK ou CREDIT" }, { status: 400 });
    }
    if (!montant || parseFloat(montant) <= 0) {
      return NextResponse.json({ error: "montant requis et > 0" }, { status: 400 });
    }

    // Vérifier la session
    const collecte = await prisma.collecteJournaliere.findUnique({ where: { id: collecteId } });
    if (!collecte) return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
    if (collecte.agentId !== agentId) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    if (collecte.statut !== "EN_COURS") return NextResponse.json({ error: "Session non active" }, { status: 400 });

    const montantNum = parseFloat(montant);

    // ── PACK ──────────────────────────────────────────────────────────────────
    if (type === "PACK") {
      if (!souscriptionId) {
        return NextResponse.json({ error: "souscriptionId requis pour type PACK" }, { status: 400 });
      }

      const souscription = await prisma.souscriptionPack.findUnique({
        where: { id: parseInt(souscriptionId) },
        include: { pack: true, client: { select: { nom: true, prenom: true, agentTerrainId: true } } },
      });
      if (!souscription) return NextResponse.json({ error: "Souscription introuvable" }, { status: 404 });
      if (!souscription.clientId) {
        return NextResponse.json({ error: "Cette souscription n'est pas liée à un client terrain" }, { status: 400 });
      }
      if (souscription.client?.agentTerrainId !== agentId) {
        return NextResponse.json({ error: "Client non assigné à cet agent" }, { status: 403 });
      }
      if (["ANNULE", "COMPLETE"].includes(souscription.statut)) {
        return NextResponse.json({ error: `Souscription déjà ${souscription.statut.toLowerCase()}` }, { status: 400 });
      }
      if (montantNum > Number(souscription.montantRestant) + 0.01) {
        return NextResponse.json(
          { error: `Montant trop élevé. Restant : ${Number(souscription.montantRestant).toLocaleString("fr-FR")} FCFA` },
          { status: 400 }
        );
      }

      const result = await prisma.$transaction(async (tx) => {
        const sid = souscription.id;

        // Prochaine échéance (pour calculer montantAttendu sur la ligne)
        const prochaineEcheance = await tx.echeancePack.findFirst({
          where: { souscriptionId: sid, statut: { in: ["EN_ATTENTE", "EN_RETARD"] } },
          orderBy: { numero: "asc" },
        });

        const montantAttendu = prochaineEcheance ? Number(prochaineEcheance.montant) : montantNum;
        const statutLigne = montantNum >= montantAttendu - 0.01 ? "COLLECTE" : "PARTIEL";

        // 1. Créer VersementPack EN_ATTENTE — effet financier appliqué par le caissier
        const versement = await tx.versementPack.create({
          data: {
            souscriptionId: sid,
            type: "VERSEMENT_PERIODIQUE",
            montant: montantNum,
            statut: "EN_ATTENTE",
            datePaiement: new Date(),
            encaisseParId: agentId,
            encaisseParNom: agentNom,
            notes: notes ?? `Session collecte ${collecte.reference} — ${agentNom}`,
          },
        });

        // 2. Créer LigneCollecte liée au versement
        const ligne = await tx.ligneCollecte.create({
          data: {
            collecteId,
            clientId: souscription.clientId!,
            souscriptionId: sid,
            montantAttendu,
            montantCollecte: montantNum,
            statut: statutLigne as "COLLECTE" | "PARTIEL",
            latitude: latitude ?? null,
            longitude: longitude ?? null,
            modePaiement: modePaiement ?? "ESPECES",
            notes: notes ?? null,
            versementPackId: versement.id,
          },
        });

        // 3. Mettre à jour montantCollecte de la session (suivi terrain uniquement)
        await tx.collecteJournaliere.update({
          where: { id: collecteId },
          data: { montantCollecte: { increment: montantNum } },
        });

        // 4. Audit
        await tx.auditLog.create({
          data: {
            userId: agentId,
            action: "COLLECTE_PACK_SESSION_EN_ATTENTE",
            entite: "LigneCollecte",
            entiteId: ligne.id,
          },
        });

        const clientNom = souscription.client
          ? `${souscription.client.prenom} ${souscription.client.nom}`
          : "—";
        await notifyAdmins(tx, {
          titre: `Collecte session à confirmer — ${souscription.pack.nom}`,
          message: `${agentNom} a collecté ${montantNum.toLocaleString("fr-FR")} FCFA chez ${clientNom} (session ${collecte.reference}). En attente de confirmation caissier.`,
          priorite: "NORMAL",
          actionUrl: "/dashboard/user/caissiers",
        });

        return { ligne, versement };
      });

      return NextResponse.json({ data: result }, { status: 201 });
    }

    // ── CRÉDIT ────────────────────────────────────────────────────────────────
    if (type === "CREDIT") {
      if (!creditId) {
        return NextResponse.json({ error: "creditId requis pour type CREDIT" }, { status: 400 });
      }

      const credit = await prisma.creditClient.findUnique({
        where: { id: parseInt(creditId) },
        include: { client: { select: { nom: true, prenom: true, agentTerrainId: true } } },
      });
      if (!credit) return NextResponse.json({ error: "Crédit introuvable" }, { status: 404 });
      if (credit.client?.agentTerrainId !== agentId) {
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

      const result = await prisma.$transaction(async (tx) => {
        // 1. Créer remboursement EN_ATTENTE_CAISSIER — effet financier appliqué par le caissier
        const remboursement = await tx.remboursementCredit.create({
          data: {
            creditId: credit.id,
            montant: montantNum,
            modePaiement: "ESPECES",
            statut: "EN_ATTENTE_CAISSIER",
            enregistreParId: agentId,
            notes: notes ?? `Session collecte ${collecte.reference} — ${agentNom}`,
          },
        });

        // 2. Mettre à jour montantCollecte de la session (suivi terrain uniquement)
        await tx.collecteJournaliere.update({
          where: { id: collecteId },
          data: { montantCollecte: { increment: montantNum } },
        });

        // 3. Audit + notif
        await tx.auditLog.create({
          data: {
            userId: agentId,
            action: "REMBOURSEMENT_CREDIT_SESSION_EN_ATTENTE",
            entite: "RemboursementCredit",
            entiteId: remboursement.id,
          },
        });

        const clientNom = credit.client
          ? `${credit.client.prenom} ${credit.client.nom}`
          : "—";
        await notifyAdmins(tx, {
          titre: `Remboursement crédit à confirmer — ${credit.reference}`,
          message: `${agentNom} a collecté ${montantNum.toLocaleString("fr-FR")} FCFA de ${clientNom} (${credit.reference}, session ${collecte.reference}). En attente de confirmation caissier.`,
          priorite: "NORMAL",
          actionUrl: "/dashboard/user/caissiers",
        });

        return remboursement;
      });

      return NextResponse.json({ data: result }, { status: 201 });
    }

    return NextResponse.json({ error: "type invalide" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/agentTerrain/collecteJour/[id]/encaisser", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
