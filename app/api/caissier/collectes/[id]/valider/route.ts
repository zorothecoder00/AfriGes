import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCaissierSession, getCaissierPdvId } from "@/lib/authCaissier";
import { notifyAdmins, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/caissier/collectes/[id]/valider
 * Body: { action: "VALIDER" | "FRAUDE", notes? }
 *
 * VALIDER : CollecteJournaliere.statut → VALIDEE (argent physique conforme)
 * FRAUDE  : CollecteJournaliere.statut → ANNULEE
 *           + blocage agent (gestionnaire.actif = false)
 *           + notification admins CRITIQUE
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const collecteId = parseInt(id);
    if (isNaN(collecteId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const action: "VALIDER" | "FRAUDE" = body.action;
    const notes: string | undefined = body.notes;

    if (!["VALIDER", "FRAUDE"].includes(action)) {
      return NextResponse.json({ error: "action doit être VALIDER ou FRAUDE" }, { status: 400 });
    }

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId   = isAdmin ? null : await getCaissierPdvId(userId);

    if (!isAdmin && !pdvId) {
      return NextResponse.json({ error: "Aucun point de vente associé à ce caissier" }, { status: 400 });
    }

    const collecte = await prisma.collecteJournaliere.findUnique({
      where: { id: collecteId },
      include: {
        agent: { select: { id: true, nom: true, prenom: true } },
      },
    });

    if (!collecte) return NextResponse.json({ error: "Collecte introuvable" }, { status: 404 });

    if (pdvId !== null && collecte.pointDeVenteId !== pdvId) {
      return NextResponse.json({ error: "Cette collecte n'appartient pas à votre point de vente" }, { status: 403 });
    }

    if (collecte.statut !== "EN_COURS") {
      return NextResponse.json(
        { error: `Cette collecte est déjà en statut "${collecte.statut}"` },
        { status: 409 }
      );
    }

    const agentNom = `${collecte.agent.prenom} ${collecte.agent.nom}`;
    const ecart    = Number(collecte.montantCollecte) - Number(collecte.montantPrevu);

    const result = await prisma.$transaction(async (tx) => {
      if (action === "VALIDER") {
        // Marquer la collecte comme validée
        const updated = await tx.collecteJournaliere.update({
          where: { id: collecteId },
          data: {
            statut:        "VALIDEE",
            valideParId:   userId,
            dateValidation: new Date(),
            ...(notes && { notes }),
          },
        });

        await auditLog(tx, userId, "VALIDATION_COLLECTE_TERRAIN", "CollecteJournaliere", collecteId);

        // Notifier l'agent
        await tx.notification.create({
          data: {
            userId:   collecte.agentId,
            titre:    "Collecte validée",
            message:  `Votre collecte du ${collecte.dateCollecte.toLocaleDateString("fr-FR")} (${collecte.reference}) a été validée par la caisse. Montant : ${Number(collecte.montantCollecte).toLocaleString("fr-FR")} FCFA.`,
            priorite: PrioriteNotification.NORMAL,
          },
        });

        await notifyAdmins(tx, {
          titre:    "Collecte terrain validée",
          message:  `La collecte ${collecte.reference} de ${agentNom} (${Number(collecte.montantCollecte).toLocaleString("fr-FR")} FCFA) a été validée par la caisse.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: "/dashboard/admin/collectes",
        });

        return updated;
      }

      // ── FRAUDE ────────────────────────────────────────────────────────────
      const updated = await tx.collecteJournaliere.update({
        where: { id: collecteId },
        data: {
          statut: "ANNULEE",
          ...(notes && { notes }),
        },
      });

      // Bloquer l'agent terrain
      await tx.gestionnaire.updateMany({
        where: { memberId: collecte.agentId },
        data:  { actif: false },
      });

      await auditLog(tx, userId, "ALERTE_FRAUDE_COLLECTE", "CollecteJournaliere", collecteId);

      // Notifier l'agent du blocage
      await tx.notification.create({
        data: {
          userId:   collecte.agentId,
          titre:    "Compte suspendu — alerte fraude",
          message:  `Votre collecte ${collecte.reference} a été signalée comme frauduleuse par la caisse. Votre compte a été suspendu. Contactez un administrateur.`,
          priorite: PrioriteNotification.URGENT,
        },
      });

      await notifyAdmins(tx, {
        titre:    "ALERTE FRAUDE — collecte terrain",
        message:  `L'agent ${agentNom} a été bloqué suite à une alerte fraude sur la collecte ${collecte.reference}. Montant prévu : ${Number(collecte.montantPrevu).toLocaleString("fr-FR")} FCFA / Collecté : ${Number(collecte.montantCollecte).toLocaleString("fr-FR")} FCFA / Écart : ${ecart.toLocaleString("fr-FR")} FCFA.${notes ? ` Note : ${notes}` : ""}`,
        priorite: PrioriteNotification.URGENT,
        actionUrl: "/dashboard/admin/agents-terrain",
      });

      return updated;
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("POST /api/caissier/collectes/[id]/valider error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
