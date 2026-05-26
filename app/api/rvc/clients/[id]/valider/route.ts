import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { notifyAdmins, auditLog } from "@/lib/notifications";
import { MemberStatus, PrioriteNotification } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/rvc/clients/[id]/valider
 *
 * Body :
 *  { action: "ACTIVER", limiteCredit?: number }
 *  { action: "REJETER", motifRejet: string }
 *
 * Workflow RVC :
 *  ACTIVER → etat = ACTIF, limiteCredit attribuée, dateValidation = now
 *  REJETER → etat = REJETE, motifRejet enregistré, dateValidation = now
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const clientId = parseInt(id);
    if (isNaN(clientId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { action, limiteCredit, motifRejet } = body as {
      action: "ACTIVER" | "REJETER";
      limiteCredit?: number;
      motifRejet?: string;
    };

    if (action !== "ACTIVER" && action !== "REJETER") {
      return NextResponse.json({ error: "action doit être ACTIVER ou REJETER" }, { status: 400 });
    }
    if (action === "REJETER" && !motifRejet?.trim()) {
      return NextResponse.json({ error: "motifRejet est requis pour un rejet" }, { status: 400 });
    }

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    // Résolution du PDV du RVC (pour vérifier l'appartenance du client)
    let rvcPdvId: number | null = null;
    if (!isAdmin) {
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId: parseInt(session.user.id), actif: true },
        select: { pointDeVenteId: true },
      });
      if (!aff) {
        return NextResponse.json({ error: "Aucun point de vente associé à ce responsable crédit" }, { status: 400 });
      }
      rvcPdvId = aff.pointDeVenteId;
    }

    const existing = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, etat: true, nom: true, prenom: true, telephone: true, agentTerrainId: true, pointDeVenteId: true },
    });
    if (!existing) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

    // Vérifier que le client appartient bien au PDV du RVC
    if (rvcPdvId !== null && existing.pointDeVenteId !== rvcPdvId) {
      return NextResponse.json({ error: "Ce client n'appartient pas à votre point de vente" }, { status: 403 });
    }

    if (existing.etat !== MemberStatus.EN_ATTENTE_VALIDATION) {
      return NextResponse.json(
        { error: `Ce client est déjà en statut "${existing.etat}", impossible de le re-valider.` },
        { status: 409 }
      );
    }

    const rvcId = parseInt(session.user.id);
    const now   = new Date();

    const client = await prisma.$transaction(async (tx) => {
      const updated = await tx.client.update({
        where: { id: clientId },
        data: {
          etat:            action === "ACTIVER" ? MemberStatus.ACTIF : MemberStatus.REJETE,
          validationParId: rvcId,
          dateValidation:  now,
          ...(action === "ACTIVER" && {
            limiteCredit: limiteCredit ? Number(limiteCredit) : null,
          }),
          ...(action === "REJETER" && {
            motifRejet: motifRejet!.trim(),
          }),
        },
      });

      await auditLog(
        tx,
        rvcId,
        action === "ACTIVER" ? "ACTIVATION_CLIENT_RVC" : "REJET_CLIENT_RVC",
        "Client",
        clientId
      );

      // Notifier l'agent terrain si disponible
      if (existing.agentTerrainId) {
        await tx.notification.create({
          data: {
            userId:   existing.agentTerrainId,
            titre:    action === "ACTIVER" ? "Client activé" : "Client rejeté",
            message:  action === "ACTIVER"
              ? `Le client ${existing.prenom} ${existing.nom} a été activé par le responsable crédit.${limiteCredit ? ` Limite de crédit : ${limiteCredit.toLocaleString("fr-FR")} FCFA.` : ""}`
              : `Le client ${existing.prenom} ${existing.nom} a été rejeté. Motif : ${motifRejet}`,
            priorite: action === "ACTIVER" ? PrioriteNotification.NORMAL : PrioriteNotification.HAUTE,
          },
        });
      }

      // Notifier les admins
      await notifyAdmins(tx, {
        titre:   action === "ACTIVER" ? "Client activé (RVC)" : "Client rejeté (RVC)",
        message: action === "ACTIVER"
          ? `Le RVC ${session.user.prenom} ${session.user.nom} a activé le client ${existing.prenom} ${existing.nom}.`
          : `Le RVC ${session.user.prenom} ${session.user.nom} a rejeté le client ${existing.prenom} ${existing.nom}. Motif : ${motifRejet}`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/admin/clients`,
      });

      return updated;
    });

    return NextResponse.json({ data: client });
  } catch (error) {
    console.error("POST /api/rvc/clients/[id]/valider error:", error);
    return NextResponse.json({ error: "Erreur lors de la validation" }, { status: 500 });
  }
}
