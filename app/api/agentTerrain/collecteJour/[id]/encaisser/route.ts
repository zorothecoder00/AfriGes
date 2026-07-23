import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { notifyAdmins, auditLog } from "@/lib/notifications";
import { enregistrerVersementPack } from "@/lib/versementPack";
import { enregistrerRemboursementCredit } from "@/lib/remboursementCredit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/agentTerrain/collecteJour/[id]/encaisser
 * Encaisse un paiement (pack ou crédit) dans la session de collecte du jour.
 * Body: { type: "PACK"|"CREDIT", souscriptionId?, creditId?, montant, modePaiement?, latitude?, longitude?, notes? }
 * Effet financier immédiat (échéances, solde) — le contrôle se fait a posteriori
 * (audit + fraude sur la session, voir app/api/caissier/collectes/[id]/valider).
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

        const out = await enregistrerVersementPack(tx, {
          souscriptionId: sid,
          montant: montantNum,
          notes: notes ?? `Session collecte ${collecte.reference} — ${agentNom}`,
          encaisseParId: agentId,
          encaisseParNom: agentNom,
          confirmer: true,
        });
        if (!out.ok) throw Object.assign(new Error(out.error), { status: 400 });

        // Ligne d'activité de la session (traçabilité + progression)
        const ligne = await tx.ligneCollecte.create({
          data: {
            collecteId,
            clientId: souscription.clientId!,
            type: "PACK",
            souscriptionId: sid,
            montantAttendu: out.montantEffectif,
            montantCollecte: out.montantEffectif,
            statut: "COLLECTE",
            latitude: latitude ?? null,
            longitude: longitude ?? null,
            modePaiement: modePaiement ?? "ESPECES",
            notes: notes ?? null,
            versementPackId: out.versementId,
          },
        });

        // Mettre à jour montantCollecte de la session (suivi terrain)
        await tx.collecteJournaliere.update({
          where: { id: collecteId },
          data: { montantCollecte: { increment: out.montantEffectif } },
        });

        await auditLog(tx, agentId, "COLLECTE_PACK_SESSION_CONFIRMEE", "LigneCollecte", ligne.id);

        const clientNom = souscription.client
          ? `${souscription.client.prenom} ${souscription.client.nom}`
          : "—";
        await notifyAdmins(tx, {
          titre: `Collecte pack — ${souscription.pack.nom}`,
          message: `${agentNom} a collecté ${out.montantEffectif.toLocaleString("fr-FR")} FCFA chez ${clientNom} (session ${collecte.reference}).`,
          priorite: "NORMAL",
          actionUrl: "/dashboard/admin/packs",
        });

        return { ligne, montantEffectif: out.montantEffectif, estSolde: out.estSolde };
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
        const out = await enregistrerRemboursementCredit(tx, {
          creditId: credit.id,
          montant: montantNum,
          numeroJour: null,
          observation: notes ?? `Session collecte ${collecte.reference} — ${agentNom}`,
          enregistreParId: agentId,
          agentCollecteurId: agentId,
          confirmer: true,
        });
        if (!out.ok) throw Object.assign(new Error(out.error), { status: 400 });

        // Ligne d'activité de la session (traçabilité + progression)
        const ligne = await tx.ligneCollecte.create({
          data: {
            collecteId,
            clientId: credit.clientId,
            type: "CREDIT",
            creditId: credit.id,
            montantAttendu: out.montantEffectif,
            montantCollecte: out.montantEffectif,
            statut: "COLLECTE",
            latitude: latitude ?? null,
            longitude: longitude ?? null,
            modePaiement: modePaiement ?? "ESPECES",
            notes: notes ?? null,
          },
        });

        // Mettre à jour montantCollecte de la session (suivi terrain)
        await tx.collecteJournaliere.update({
          where: { id: collecteId },
          data: { montantCollecte: { increment: out.montantEffectif } },
        });

        await auditLog(tx, agentId, "REMBOURSEMENT_CREDIT_SESSION_CONFIRME", "RemboursementCredit", out.remboursementId);

        const clientNom = credit.client
          ? `${credit.client.prenom} ${credit.client.nom}`
          : "—";
        await notifyAdmins(tx, {
          titre: `Remboursement crédit — ${credit.reference}`,
          message: `${agentNom} a collecté ${out.montantEffectif.toLocaleString("fr-FR")} FCFA de ${clientNom} (${credit.reference}, session ${collecte.reference}).`,
          priorite: "NORMAL",
          actionUrl: "/dashboard/admin/credits",
        });

        return { ligne, montantEffectif: out.montantEffectif, estSolde: out.estSolde };
      });

      return NextResponse.json({ data: result }, { status: 201 });
    }

    return NextResponse.json({ error: "type invalide" }, { status: 400 });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    if (status === 500) console.error("POST /api/agentTerrain/collecteJour/[id]/encaisser", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status });
  }
}
