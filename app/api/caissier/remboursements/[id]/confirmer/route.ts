import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCaissierSession, getCaissierPdvId } from "@/lib/authCaissier";
import { notifyAdmins, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

function genRef(): string {
  const d   = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ENC-${ymd}-${rand}`;
}

/**
 * POST /api/caissier/remboursements/[id]/confirmer
 * Confirme ou rejette un RemboursementCredit EN_ATTENTE_CAISSIER.
 * Body: { action: "CONFIRMER" | "REJETER", notes? }
 *
 * CONFIRMER → statut CONFIRME + effet financier (crédit + échéances + client.soldeActuel + OperationCaisse)
 * REJETER   → statut REJETE
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const remboursementId = parseInt(id);
    if (isNaN(remboursementId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { action, notes } = body as { action: string; notes?: string };

    if (!["CONFIRMER", "REJETER"].includes(action)) {
      return NextResponse.json({ error: "action doit être CONFIRMER ou REJETER" }, { status: 400 });
    }

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId   = isAdmin ? null : await getCaissierPdvId(userId);
    const caissierNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();

    // Récupérer le remboursement
    const remboursement = await prisma.remboursementCredit.findFirst({
      where: {
        id:     remboursementId,
        statut: "EN_ATTENTE_CAISSIER",
        ...(pdvId ? { credit: { client: { pointDeVenteId: pdvId } } } : {}),
      },
      include: {
        credit:         { include: { client: { select: { id: true, nom: true, prenom: true } } } },
        enregistrePar:  { select: { id: true, nom: true, prenom: true } },
      },
    });

    if (!remboursement) {
      return NextResponse.json(
        { error: "Remboursement EN_ATTENTE_CAISSIER introuvable ou hors périmètre" },
        { status: 404 }
      );
    }

    const credit     = remboursement.credit;
    const montantNum = Number(remboursement.montant);

    // ── REJET ──────────────────────────────────────────────────────────────────
    if (action === "REJETER") {
      await prisma.$transaction(async (tx) => {
        await tx.remboursementCredit.update({
          where: { id: remboursementId },
          data:  { statut: "REJETE", notes: notes ? `[Rejeté] ${notes}` : "[Rejeté par caissier]" },
        });

        await auditLog(tx, userId, "REMBOURSEMENT_CREDIT_REJETE", "RemboursementCredit", remboursementId);

        if (remboursement.enregistreParId) {
          await tx.notification.create({
            data: {
              userId:    remboursement.enregistreParId,
              titre:     "Remboursement rejeté",
              message:   `Votre remboursement de ${montantNum.toLocaleString("fr-FR")} FCFA (${credit.reference}) a été rejeté par le caissier.${notes ? ` Motif : ${notes}` : ""}`,
              priorite:  "HAUTE",
              actionUrl: "/dashboard/user/agentsTerrain",
            },
          });
        }
      });

      return NextResponse.json({ success: true, message: "Remboursement rejeté" });
    }

    // ── CONFIRMATION ───────────────────────────────────────────────────────────
    if (!["ACTIF", "EN_RETARD"].includes(credit.statut)) {
      return NextResponse.json(
        { error: `Crédit ${credit.statut.toLowerCase()}, impossible de confirmer` },
        { status: 400 }
      );
    }

    const nouveauSolde = Number(credit.soldeRestant) - montantNum;
    const estSolde     = nouveauSolde <= 0.01;

    const sessionActive = await prisma.sessionCaisse.findFirst({
      where: {
        statut:    { in: ["OUVERTE", "SUSPENDUE"] },
        caissierId: userId,
      },
      orderBy: { createdAt: "desc" },
    });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Confirmer le remboursement
      await tx.remboursementCredit.update({
        where: { id: remboursementId },
        data:  { statut: "CONFIRME" },
      });

      // 2. Mettre à jour les échéances crédit
      const echeances = await tx.echeanceCredit.findMany({
        where:   { creditId: credit.id, statut: { in: ["EN_ATTENTE", "EN_RETARD"] } },
        orderBy: { dateEcheance: "asc" },
      });
      let budget = montantNum;
      for (const ec of echeances) {
        if (budget <= 0) break;
        const du = Number(ec.montantDu) - Number(ec.montantPaye);
        if (budget >= du - 0.01) {
          await tx.echeanceCredit.update({
            where: { id: ec.id },
            data:  { statut: "PAYE", montantPaye: Number(ec.montantDu) },
          });
          budget -= du;
        } else {
          await tx.echeanceCredit.update({
            where: { id: ec.id },
            data:  { statut: "PARTIEL", montantPaye: { increment: budget } },
          });
          budget = 0;
        }
      }

      // 3. Mettre à jour le crédit
      await tx.creditClient.update({
        where: { id: credit.id },
        data:  {
          montantRembourse: { increment: montantNum },
          soldeRestant:     estSolde ? 0 : nouveauSolde,
          statut:           estSolde ? "SOLDE" : credit.statut,
        },
      });

      // 4. Décrémenter la dette du client
      await tx.client.update({
        where: { id: credit.clientId },
        data:  { soldeActuel: { decrement: montantNum } },
      });

      // 5. Créer une OperationCaisse si session active
      if (sessionActive) {
        const collecteurNom = remboursement.enregistrePar
          ? `${remboursement.enregistrePar.prenom} ${remboursement.enregistrePar.nom}`
          : "agent";
        await tx.operationCaisse.create({
          data: {
            sessionId:    sessionActive.id,
            type:         "ENCAISSEMENT",
            mode:         "ESPECES",
            montant:      new Prisma.Decimal(montantNum),
            motif:        `Remboursement crédit confirmé — ${credit.reference} (${collecteurNom})`,
            reference:    genRef(),
            operateurNom: caissierNom,
            operateurId:  userId,
          },
        });
      }

      // 6. Hook RIA — cascade vers RemboursementRIA si ce crédit finance des portefeuilles
      const financementsRIA = await tx.operationFinancementRIA.findMany({
        where: { creditClientId: credit.id, statut: { in: ["ACTIF", "EN_RETARD"] } },
      });

      for (const fin of financementsRIA) {
        const part = montantNum * (Number(fin.montantFinance) / Number(credit.montantTotal));
        if (part <= 0) continue;

        await tx.remboursementRIA.create({
          data: { financementId: fin.id, montant: part, remboursementCreditId: remboursementId },
        });

        const newEncours    = Math.max(0, Number(fin.encours) - part);
        const finEstSolde   = newEncours <= 0.01;

        await tx.operationFinancementRIA.update({
          where: { id: fin.id },
          data: {
            montantRembourse: { increment: part },
            encours:          finEstSolde ? 0 : { decrement: part },
            statut:           finEstSolde ? "REMBOURSE" : fin.statut,
          },
        });

        await tx.portefeuilleRIA.update({
          where: { id: fin.portefeuilleId },
          data: {
            capitalRecouvre: { increment: part },
            capitalEngage:   { decrement: finEstSolde ? Number(fin.encours) : part },
          },
        });

        await tx.mouvementFondsRIA.create({
          data: {
            portefeuilleId: fin.portefeuilleId,
            type:           "REMBOURSEMENT_CLIENT",
            sens:           "CREDIT",
            montant:        part,
            financementId:  fin.id,
            description:    `Remboursement crédit ${credit.reference} — part RIA`,
            reference:      `RIA-RMB-${Date.now()}`,
          },
        });
      }

      // 7. Audit + notifications
      await auditLog(tx, userId, "REMBOURSEMENT_CREDIT_CONFIRME", "RemboursementCredit", remboursementId);

      const clientNom = credit.client
        ? `${credit.client.prenom} ${credit.client.nom}`
        : "—";

      await notifyAdmins(tx, {
        titre:    `Remboursement confirmé — ${credit.reference}`,
        message:  `${caissierNom} a confirmé ${montantNum.toLocaleString("fr-FR")} FCFA de ${clientNom} (${credit.reference}).${estSolde ? " Crédit soldé !" : ` Solde restant : ${Math.max(0, nouveauSolde).toLocaleString("fr-FR")} FCFA.`}`,
        priorite: estSolde ? "HAUTE" : "NORMAL",
        actionUrl: "/dashboard/admin/credits",
      });

      if (remboursement.enregistreParId) {
        await tx.notification.create({
          data: {
            userId:    remboursement.enregistreParId,
            titre:     "Remboursement confirmé",
            message:   `Votre remboursement de ${montantNum.toLocaleString("fr-FR")} FCFA (${credit.reference}) a été confirmé par le caissier.`,
            priorite:  "NORMAL",
            actionUrl: "/dashboard/user/agentsTerrain",
          },
        });
      }

      return { remboursementId, estSolde, nouveauSolde: estSolde ? 0 : nouveauSolde };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("POST /api/caissier/remboursements/[id]/confirmer", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
