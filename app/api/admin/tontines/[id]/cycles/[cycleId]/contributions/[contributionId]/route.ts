import { NextResponse } from "next/server";
import { StatutContribution, StatutCycle, PrioriteNotification, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { genererCreditAlimentaireDepuisTontine } from "@/lib/creditAlimentaireAuto";

interface RouteParams {
  params: Promise<{ id: string; cycleId: string; contributionId: string }>;
}

/**
 * PATCH /api/admin/tontines/[id]/cycles/[cycleId]/contributions/[contributionId]
 * Marquer une contribution comme payée
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await getAuthSession();
    if (!session || !session.user.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { id, cycleId, contributionId } = await params;
    const tontineId = Number(id);
    const cycleIdNum = Number(cycleId);
    const contributionIdNum = Number(contributionId);

    if (isNaN(tontineId) || isNaN(cycleIdNum) || isNaN(contributionIdNum)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const body = await req.json();
    const { notePaiement } = body;

    const result = await prisma.$transaction(async (tx) => {
      // Vérifier que la contribution existe et appartient au bon cycle/tontine
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

      if (!contribution || contribution.cycle.tontineId !== tontineId || contribution.cycleId !== cycleIdNum) {
        throw new Error("CONTRIBUTION_INTROUVABLE");
      }

      if (contribution.statut === StatutContribution.PAYEE) {
        throw new Error("DEJA_PAYEE");
      }

      if (contribution.cycle.statut !== StatutCycle.EN_COURS) {
        throw new Error("CYCLE_NON_EN_COURS");
      }

      // Marquer la contribution comme payée
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
          action: "PAIEMENT_CONTRIBUTION_TONTINE",
          entite: "TontineContribution",
          entiteId: contributionIdNum,
        },
      });

      // Vérifier si toutes les contributions du cycle sont payées
      const enAttente = await tx.tontineContribution.count({
        where: { cycleId: cycleIdNum, statut: StatutContribution.EN_ATTENTE },
      });

      let cycleCloture = false;
      let creditAlimentaireGenere = false;

      if (enAttente === 0) {
        // Clôturer le cycle
        await tx.tontineCycle.update({
          where: { id: cycleIdNum },
          data: {
            statut: StatutCycle.COMPLETE,
            dateCloture: new Date(),
          },
        });

        cycleCloture = true;

        // Récupérer le bénéficiaire du cycle
        const cycle = await tx.tontineCycle.findUnique({
          where: { id: cycleIdNum },
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
          // Générer le crédit alimentaire auto
          const credit = await genererCreditAlimentaireDepuisTontine(tx, {
            cycleId: cycleIdNum,
            clientId: cycle.beneficiaire.clientId,
            memberId: cycle.beneficiaire.memberId,
            montantPot: cycle.montantPot,
          });

          creditAlimentaireGenere = credit !== null;

          // Notification de clôture
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
                titre: `Cycle ${cycle.numeroCycle} complete`,
                message: `Le cycle ${cycle.numeroCycle} de la tontine est complet. Le pot de ${cycle.montantPot} FCFA a ete attribue a ${benefNom}.`,
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
    console.error("PATCH contribution error:", error);

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

    return NextResponse.json({ error: "Erreur lors du marquage de la contribution" }, { status: 500 });
  }
}
