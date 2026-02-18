import { NextResponse } from "next/server";
import { Prisma, StatutTontine, StatutCycle, StatutContribution, PrioriteNotification, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/tontines/[id]/cycles
 * Liste tous les cycles d'une tontine
 */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const session = await getAuthSession();
    if (!session || !session.user.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { id } = await params;
    const tontineId = Number(id);

    if (isNaN(tontineId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const cycles = await prisma.tontineCycle.findMany({
      where: { tontineId },
      include: {
        beneficiaire: {
          include: {
            client: { select: { id: true, nom: true, prenom: true, telephone: true } },
          },
        },
        contributions: {
          include: {
            membre: {
              include: {
                client: { select: { id: true, nom: true, prenom: true, telephone: true } },
              },
            },
          },
          orderBy: { membre: { ordreTirage: "asc" } },
        },
      },
      orderBy: { numeroCycle: "desc" },
    });

    return NextResponse.json({ data: cycles });
  } catch (error) {
    console.error("GET /admin/tontines/[id]/cycles error:", error);
    return NextResponse.json({ error: "Erreur lors du chargement des cycles" }, { status: 500 });
  }
}

/**
 * POST /api/admin/tontines/[id]/cycles
 * Démarrer un nouveau cycle
 */
export async function POST(_req: Request, { params }: RouteParams) {
  try {
    const session = await getAuthSession();
    if (!session || !session.user.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { id } = await params;
    const tontineId = Number(id);

    if (isNaN(tontineId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const tontine = await prisma.tontine.findUnique({
      where: { id: tontineId },
      include: {
        membres: { orderBy: { ordreTirage: "asc" } },
      },
    });

    if (!tontine) {
      return NextResponse.json({ error: "Tontine introuvable" }, { status: 404 });
    }

    if (tontine.statut !== StatutTontine.ACTIVE) {
      return NextResponse.json({ error: "La tontine n'est pas active" }, { status: 400 });
    }

    if (tontine.membres.length === 0) {
      return NextResponse.json({ error: "La tontine n'a aucun membre" }, { status: 400 });
    }

    // Vérifier qu'il n'y a pas de cycle en cours
    const cycleEnCours = await prisma.tontineCycle.findFirst({
      where: { tontineId, statut: StatutCycle.EN_COURS },
    });

    if (cycleEnCours) {
      return NextResponse.json({ error: "Un cycle est deja en cours" }, { status: 400 });
    }

    // Déterminer le prochain numéro de cycle
    const dernierCycle = await prisma.tontineCycle.findFirst({
      where: { tontineId },
      orderBy: { numeroCycle: "desc" },
    });

    const nextNumeroCycle = (dernierCycle?.numeroCycle ?? 0) + 1;

    // Trouver le bénéficiaire selon l'ordre de tirage
    const beneficiaire = tontine.membres.find((m) => m.ordreTirage === nextNumeroCycle);

    if (!beneficiaire) {
      // Plus de bénéficiaire → tontine terminée
      await prisma.tontine.update({
        where: { id: tontineId },
        data: { statut: StatutTontine.TERMINEE },
      });

      return NextResponse.json({
        message: "Tous les membres ont recu le pot. La tontine est terminee.",
        tontineTerminee: true,
      });
    }

    // Calculer le pot
    const montantPot = new Prisma.Decimal(tontine.montantCycle).mul(tontine.membres.length);

    const cycle = await prisma.$transaction(async (tx) => {
      // Créer le cycle
      const created = await tx.tontineCycle.create({
        data: {
          tontineId,
          numeroCycle: nextNumeroCycle,
          beneficiaireId: beneficiaire.id,
          montantPot,
          statut: StatutCycle.EN_COURS,
        },
        include: {
          beneficiaire: {
            include: {
              client: { select: { id: true, nom: true, prenom: true, telephone: true } },
            },
          },
        },
      });

      // Créer une contribution par membre
      await tx.tontineContribution.createMany({
        data: tontine.membres.map((m) => ({
          cycleId: created.id,
          membreId: m.id,
          montant: tontine.montantCycle,
          statut: StatutContribution.EN_ATTENTE,
        })),
      });

      // Récupérer le cycle complet avec contributions
      const cycleComplet = await tx.tontineCycle.findUnique({
        where: { id: created.id },
        include: {
          beneficiaire: {
            include: {
              client: { select: { id: true, nom: true, prenom: true, telephone: true } },
            },
          },
          contributions: {
            include: {
              membre: {
                include: {
                  client: { select: { id: true, nom: true, prenom: true, telephone: true } },
                },
              },
            },
            orderBy: { membre: { ordreTirage: "asc" } },
          },
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: parseInt(session.user.id),
          action: "DEMARRAGE_CYCLE_TONTINE",
          entite: "TontineCycle",
          entiteId: created.id,
        },
      });

      // Notification admins
      const admins = await tx.user.findMany({
        where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
        select: { id: true },
      });

      const benefNom = created.beneficiaire.client
        ? `${created.beneficiaire.client.prenom} ${created.beneficiaire.client.nom}`
        : "Membre";

      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            titre: `Cycle ${nextNumeroCycle} demarre`,
            message: `Le cycle ${nextNumeroCycle} de la tontine "${tontine.nom}" a demarre. Beneficiaire : ${benefNom}. Pot : ${montantPot} FCFA.`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/admin/tontines/${tontineId}`,
          })),
        });
      }

      return cycleComplet;
    });

    return NextResponse.json({ data: cycle }, { status: 201 });
  } catch (error) {
    console.error("POST /admin/tontines/[id]/cycles error:", error);
    return NextResponse.json({ error: "Erreur lors du demarrage du cycle" }, { status: 500 });
  }
}
