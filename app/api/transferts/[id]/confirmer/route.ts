import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { notifyAdmins, notify, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

const ROLES_AUTORISES = [
  "RESPONSABLE_POINT_DE_VENTE",
  "MAGAZINIER",
  "AGENT_LOGISTIQUE_APPROVISIONNEMENT",
];

/**
 * POST /api/transferts/[id]/confirmer
 *
 * Confirmation de réception d'un transfert de stock par le personnel du PDV destination.
 * Rôles autorisés : RPV, Magasinier, Agent Logistique du PDV destination.
 *
 * Conséquences :
 *  - TransfertStock.statut EN_COURS|EXPEDIE → RECU
 *  - Stock incrémenté sur le PDV destination
 *  - MouvementStock ENTREE (TRANSFERT_ENTRANT) créé par produit
 *  - Notification aux admins
 */
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const transfertId = parseInt(id);
    const userId = parseInt(session.user.id);

    // Récupère l'affectation active de l'utilisateur
    const affectation = await prisma.gestionnaireAffectation.findFirst({
      where: {
        userId,
        actif: true,
        user: {
          gestionnaire: {
            role: { in: ROLES_AUTORISES as never[] },
            actif: true,
          },
        },
      },
      select: { pointDeVenteId: true },
    });

    if (!affectation) {
      return NextResponse.json(
        { error: "Accès refusé — vous n'êtes pas affecté à un PDV avec le rôle requis" },
        { status: 403 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const transfert = await tx.transfertStock.findUnique({
        where: { id: transfertId },
        include: {
          lignes:      true,
          origine:     { select: { id: true, nom: true } },
          destination: { select: { id: true, nom: true } },
        },
      });

      if (!transfert) throw new Error("Transfert introuvable");

      // Vérifie que l'utilisateur est bien affecté au PDV destination
      if (affectation.pointDeVenteId !== transfert.destinationId) {
        throw new Error("Vous n'êtes pas autorisé à confirmer ce transfert — vous n'êtes pas affecté au PDV destination");
      }

      if (!["EN_COURS", "EXPEDIE"].includes(transfert.statut)) {
        throw new Error(`Ce transfert est déjà ${transfert.statut.toLowerCase()}`);
      }

      // Incrémenter le stock destination + créer mouvements ENTREE
      for (const ligne of transfert.lignes) {
        await tx.stockSite.upsert({
          where: { produitId_pointDeVenteId: { produitId: ligne.produitId, pointDeVenteId: transfert.destinationId } },
          update: { quantite: { increment: ligne.quantite } },
          create: { produitId: ligne.produitId, pointDeVenteId: transfert.destinationId, quantite: ligne.quantite },
        });

        await tx.mouvementStock.create({
          data: {
            produitId:        ligne.produitId,
            pointDeVenteId:   transfert.destinationId,
            type:             "ENTREE",
            typeEntree:       "TRANSFERT_ENTRANT",
            quantite:         ligne.quantite,
            motif:            `Réception transfert ${transfert.reference} depuis ${transfert.origine.nom}`,
            reference:        `${transfert.reference}-ENTREE-${ligne.produitId}-${Date.now()}`,
            operateurId:      userId,
            transfertStockId: transfert.id,
          },
        });
      }

      const updated = await tx.transfertStock.update({
        where: { id: transfertId },
        data: {
          statut:        "RECU",
          valideParId:   userId,
          dateReception: new Date(),
        },
      });

      // Notifie les admins
      await notifyAdmins(tx, {
        titre:    `Transfert confirmé — ${transfert.reference}`,
        message:  `Le personnel de "${transfert.destination.nom}" a confirmé la réception du transfert ${transfert.reference} depuis "${transfert.origine.nom}". Stock mis à jour.`,
        priorite: "NORMAL",
        actionUrl: `/dashboard/admin/stock`,
      });

      // Notifie les autres membres du staff destination (les autres confirmataires potentiels)
      const autresStaff = await tx.gestionnaireAffectation.findMany({
        where: {
          pointDeVenteId: transfert.destinationId,
          actif: true,
          userId: { not: userId },
          user: {
            gestionnaire: {
              role: { in: ROLES_AUTORISES as never[] },
              actif: true,
            },
          },
        },
        select: { userId: true },
      });
      await notify(tx, autresStaff.map((a) => a.userId), {
        titre:    `Transfert reçu — ${transfert.reference}`,
        message:  `Le transfert ${transfert.reference} a été confirmé et le stock de votre PDV a été mis à jour.`,
        priorite: "NORMAL",
        actionUrl: `/dashboard/transferts`,
      });

      await auditLog(tx, userId, "TRANSFERT_STOCK_RECU_PDV", "TransfertStock", transfertId);
      return updated;
    });

    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erreur serveur";
    console.error("POST /api/transferts/[id]/confirmer error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
