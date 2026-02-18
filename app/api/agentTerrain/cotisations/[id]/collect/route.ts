import { NextResponse } from "next/server";
import { StatutCotisation, Role, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { genererCreditAlimentaireDepuisCotisation } from "@/lib/creditAlimentaireAuto";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/agentTerrain/cotisations/[id]/collect
 * Marquer une cotisation comme payée (collecte terrain)
 */
export async function PATCH(_req: Request, { params }: RouteParams) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { id } = await params;
    const cotisationId = Number(id);

    if (isNaN(cotisationId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const cotisation = await tx.cotisation.findUnique({
        where: { id: cotisationId },
        include: { client: { select: { id: true, nom: true, prenom: true } } },
      });

      if (!cotisation) {
        throw new Error("COTISATION_INTROUVABLE");
      }

      if (cotisation.statut !== StatutCotisation.EN_ATTENTE) {
        throw new Error("COTISATION_NON_EN_ATTENTE");
      }

      const updated = await tx.cotisation.update({
        where: { id: cotisationId },
        data: {
          statut: StatutCotisation.PAYEE,
          datePaiement: new Date(),
        },
        include: {
          client: { select: { id: true, nom: true, prenom: true, telephone: true } },
        },
      });

      // Générer crédit alimentaire auto
      let creditAlimentaireGenere = false;
      if (updated.clientId) {
        const credit = await genererCreditAlimentaireDepuisCotisation(tx, {
          id: cotisationId,
          clientId: updated.clientId,
          montant: updated.montant,
        });
        creditAlimentaireGenere = credit !== null;
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: parseInt(session.user.id),
          action: "COLLECTE_COTISATION_TERRAIN",
          entite: "Cotisation",
          entiteId: cotisationId,
        },
      });

      // Notification admins
      const admins = await tx.user.findMany({
        where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
        select: { id: true },
      });

      const clientNom = cotisation.client
        ? `${cotisation.client.prenom} ${cotisation.client.nom}`
        : "Client";

      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            titre: "Cotisation collectee (terrain)",
            message: `L'agent ${session.user.prenom} ${session.user.nom} a collecte la cotisation de ${clientNom} (${updated.montant} FCFA).`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/admin/cotisations/${cotisationId}`,
          })),
        });
      }

      return { cotisation: updated, creditAlimentaireGenere };
    });

    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    console.error("PATCH /agentTerrain/cotisations/[id]/collect error:", error);

    if (error instanceof Error) {
      if (error.message === "COTISATION_INTROUVABLE") {
        return NextResponse.json({ error: "Cotisation introuvable" }, { status: 404 });
      }
      if (error.message === "COTISATION_NON_EN_ATTENTE") {
        return NextResponse.json({ error: "Cette cotisation n'est pas en attente" }, { status: 400 });
      }
    }

    return NextResponse.json({ error: "Erreur lors de la collecte" }, { status: 500 });
  }
}
