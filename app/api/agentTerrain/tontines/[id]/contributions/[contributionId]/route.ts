import { NextResponse } from "next/server";
import { StatutContribution, StatutCycle, PrioriteNotification, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { genererCreditAlimentaireDepuisTontine } from "@/lib/creditAlimentaireAuto";

interface RouteParams {
  params: Promise<{ id: string; contributionId: string }>;
}

/**
 * PATCH /api/agentTerrain/tontines/[id]/contributions/[contributionId]
 * Marquer une contribution tontine comme payée (collecte terrain)
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { id, contributionId } = await params;
    const tontineId = Number(id);
    const contributionIdNum = Number(contributionId);

    if (isNaN(tontineId) || isNaN(contributionIdNum)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { notePaiement } = body;

    const result = await prisma.$transaction(async (tx) => {
      const contribution = await tx.tontineContribution.findUnique({
        where: { id: contributionIdNum },
        include: {
          cycle: { include: { tontine: true } },
          membre: {
            include: {
              client: { select: { id: true, nom: true, prenom: true } },
            },
          },
        },
      });

      if (!contribution || contribution.cycle.tontineId !== tontineId) {
        throw new Error("CONTRIBUTION_INTROUVABLE");
      }

      if (contribution.statut === StatutContribution.PAYEE) {
        throw new Error("DEJA_PAYEE");
      }

      if (contribution.cycle.statut !== StatutCycle.EN_COURS) {
        throw new Error("CYCLE_NON_EN_COURS");
      }

      const updated = await tx.tontineContribution.update({
        where: { id: contributionIdNum },
        data: {
          statut: StatutContribution.PAYEE,
          datePaiement: new Date(),
          notePaiement: notePaiement || null,
        },
        include: {
          membre: {
            include: {
              client: { select: { id: true, nom: true, prenom: true, telephone: true } },
            },
          },
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: parseInt(session.user.id),
          action: "COLLECTE_CONTRIBUTION_TERRAIN",
          entite: "TontineContribution",
          entiteId: contributionIdNum,
        },
      });

      // Vérifier si toutes les contributions sont payées
      const enAttente = await tx.tontineContribution.count({
        where: { cycleId: contribution.cycleId, statut: StatutContribution.EN_ATTENTE },
      });

      let cycleCloture = false;
      let creditAlimentaireGenere = false;

      if (enAttente === 0) {
        await tx.tontineCycle.update({
          where: { id: contribution.cycleId },
          data: { statut: StatutCycle.COMPLETE, dateCloture: new Date() },
        });

        cycleCloture = true;

        const cycle = await tx.tontineCycle.findUnique({
          where: { id: contribution.cycleId },
          include: {
            beneficiaire: {
              include: {
                client: { select: { id: true, nom: true, prenom: true } },
                member: { select: { id: true, nom: true, prenom: true } },
              },
            },
          },
        });

        if (cycle) {
          const credit = await genererCreditAlimentaireDepuisTontine(tx, {
            cycleId: contribution.cycleId,
            clientId: cycle.beneficiaire.clientId,
            memberId: cycle.beneficiaire.memberId,
            montantPot: cycle.montantPot,
          });
          creditAlimentaireGenere = credit !== null;

          // Notification
          const admins = await tx.user.findMany({
            where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
            select: { id: true },
          });

          const benefNom = cycle.beneficiaire.client
            ? `${cycle.beneficiaire.client.prenom} ${cycle.beneficiaire.client.nom}`
            : "Membre";

          if (admins.length > 0) {
            await tx.notification.createMany({
              data: admins.map((admin) => ({
                userId: admin.id,
                titre: `Cycle ${cycle.numeroCycle} complete (terrain)`,
                message: `L'agent ${session.user.prenom} ${session.user.nom} a complete le cycle ${cycle.numeroCycle}. Pot de ${cycle.montantPot} FCFA attribue a ${benefNom}.`,
                priorite: PrioriteNotification.NORMAL,
                actionUrl: `/dashboard/admin/tontines/${tontineId}`,
              })),
            });
          }
        }
      }

      return { contribution: updated, cycleCloture, creditAlimentaireGenere };
    });

    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    console.error("PATCH /agentTerrain/tontines contribution error:", error);

    if (error instanceof Error) {
      if (error.message === "CONTRIBUTION_INTROUVABLE") {
        return NextResponse.json({ error: "Contribution introuvable" }, { status: 404 });
      }
      if (error.message === "DEJA_PAYEE") {
        return NextResponse.json({ error: "Cette contribution est deja payee" }, { status: 400 });
      }
      if (error.message === "CYCLE_NON_EN_COURS") {
        return NextResponse.json({ error: "Le cycle n'est pas en cours" }, { status: 400 });
      }
    }

    return NextResponse.json({ error: "Erreur lors de la collecte" }, { status: 500 });
  }
}
