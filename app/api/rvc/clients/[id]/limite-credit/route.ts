import { NextResponse } from "next/server";
import { MemberStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { auditLog, notifyAdmins } from "@/lib/notifications";
import { PrioriteNotification } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/rvc/clients/[id]/limite-credit
 * Body: { limiteCredit: number }
 *
 * Permet au RVC de modifier le plafond crédit d'un client ACTIF.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const clientId = parseInt(id);
    if (isNaN(clientId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const limiteCredit = body.limiteCredit !== undefined ? Number(body.limiteCredit) : undefined;
    if (limiteCredit === undefined || isNaN(limiteCredit) || limiteCredit < 0) {
      return NextResponse.json({ error: "limiteCredit invalide (nombre ≥ 0 requis)" }, { status: 400 });
    }

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    // Résolution du PDV du RVC
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
      select: { id: true, etat: true, nom: true, prenom: true, pointDeVenteId: true, limiteCredit: true },
    });
    if (!existing) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

    if (rvcPdvId !== null && existing.pointDeVenteId !== rvcPdvId) {
      return NextResponse.json({ error: "Ce client n'appartient pas à votre point de vente" }, { status: 403 });
    }

    if (existing.etat !== MemberStatus.ACTIF) {
      return NextResponse.json({ error: "Le plafond crédit ne peut être modifié que pour un client ACTIF" }, { status: 422 });
    }

    const rvcId = parseInt(session.user.id);

    const updated = await prisma.$transaction(async (tx) => {
      const client = await tx.client.update({
        where: { id: clientId },
        data: { limiteCredit },
      });

      await auditLog(tx, rvcId, "MODIFICATION_LIMITE_CREDIT", "Client", clientId);

      await notifyAdmins(tx, {
        titre:    "Plafond crédit modifié (RVC)",
        message:  `Le RVC ${session.user.prenom} ${session.user.nom} a modifié le plafond crédit de ${existing.prenom} ${existing.nom} : ${Number(existing.limiteCredit ?? 0).toLocaleString("fr-FR")} → ${limiteCredit.toLocaleString("fr-FR")} FCFA.`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/admin/clients`,
      });

      return client;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/rvc/clients/[id]/limite-credit error:", error);
    return NextResponse.json({ error: "Erreur lors de la modification du plafond crédit" }, { status: 500 });
  }
}
