import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getChefAgenceSession, getChefAgencePdvIds } from "@/lib/authChefAgence";
import { notify, notifyRoles, auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/chef-agence/approvisionnement/[id]
 * Validation par le chef d'agence d'une demande de réapprovisionnement
 * soumise par un de ses PDV (CDC §7 étape 2), avant transmission à l'appro
 * central. Body: { action: "VALIDER" | "REJETER", notes? }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getChefAgenceSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const commandeId = Number(id);

    const commande = await prisma.commandeInterne.findUnique({
      where: { id: commandeId },
      include: { pointDeVente: { select: { id: true, nom: true } } },
    });
    if (!commande) return NextResponse.json({ message: "Demande introuvable" }, { status: 404 });
    if (commande.statut !== "EN_VALIDATION_AGENCE") {
      return NextResponse.json({ message: "Cette demande n'est pas en attente de validation" }, { status: 422 });
    }

    const pdvIds = await getChefAgencePdvIds(session);
    if (pdvIds !== null && !pdvIds.includes(commande.pointDeVenteId)) {
      return NextResponse.json({ message: "Ce point de vente n'est pas dans votre zone" }, { status: 403 });
    }

    const { action, notes } = await req.json() as { action: "VALIDER" | "REJETER"; notes?: string };
    const userId = parseInt(session.user.id);

    if (action === "VALIDER") {
      const updated = await prisma.$transaction(async (tx) => {
        const c = await tx.commandeInterne.update({ where: { id: commandeId }, data: { statut: "SOUMISE" } });
        await auditLog(tx, userId, "COMMANDE_INTERNE_VALIDEE_AGENCE", "CommandeInterne", commandeId, undefined, getRequestMeta(req));
        await notifyRoles(tx, ["AGENT_LOGISTIQUE_APPROVISIONNEMENT"], {
          titre:    `Demande réappro validée : ${commande.reference}`,
          message:  `${session.user.prenom} ${session.user.nom} (chef d'agence) a validé la demande pour "${commande.pointDeVente.nom}" — à traiter.`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl:"/dashboard/user/logistiquesApprovisionnements/commandes-internes",
        });
        return c;
      });
      return NextResponse.json({ data: updated });
    }

    if (action === "REJETER") {
      const updated = await prisma.$transaction(async (tx) => {
        const c = await tx.commandeInterne.update({
          where: { id: commandeId },
          data: { statut: "ANNULE", notes: notes ? `${commande.notes ? commande.notes + " — " : ""}Rejet chef d'agence : ${notes}` : commande.notes },
        });
        await auditLog(tx, userId, "COMMANDE_INTERNE_REJETEE_AGENCE", "CommandeInterne", commandeId, { motif: notes ?? null }, getRequestMeta(req));
        await notify(tx, [commande.demandeurId], {
          titre:    `Demande rejetée : ${commande.reference}`,
          message:  `Votre demande de réapprovisionnement pour "${commande.pointDeVente.nom}" a été rejetée par le chef d'agence${notes ? ` : ${notes}` : "."}`,
          priorite: PrioriteNotification.HAUTE,
          actionUrl:"/dashboard/user",
        });
        return c;
      });
      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({ message: "Action inconnue" }, { status: 400 });
  } catch (error) {
    console.error("PATCH /api/chef-agence/approvisionnement/[id] error:", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
