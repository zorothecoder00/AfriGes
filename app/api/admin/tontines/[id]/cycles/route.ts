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

    // Fix Bug 5 : filtrer uniquement les membres actifs (dateSortie: null)
    const tontine = await prisma.tontine.findUnique({
      where: { id: tontineId },
      include: {
        membres: {
          where: { dateSortie: null },
          orderBy: { ordreTirage: "asc" },
        },
      },
    });

    if (!tontine) {
      return NextResponse.json({ error: "Tontine introuvable" }, { status: 404 });
    }

    if (tontine.statut !== StatutTontine.ACTIVE) {
      return NextResponse.json({ error: "La tontine n'est pas active" }, { status: 400 });
    }

    const activeMembers = tontine.membres;

    if (activeMembers.length === 0) {
      return NextResponse.json({ error: "La tontine n'a aucun membre actif" }, { status: 400 });
    }

    // Vérifier qu'il n'y a pas de cycle en cours
    const cycleEnCours = await prisma.tontineCycle.findFirst({
      where: { tontineId, statut: StatutCycle.EN_COURS },
    });

    if (cycleEnCours) {
      return NextResponse.json({ error: "Un cycle est deja en cours" }, { status: 400 });
    }

    // Fix Bug 6 : valider que les ordres de tirage sont définis, uniques et séquentiels (1..N)
    if (activeMembers.some(m => m.ordreTirage === null)) {
      return NextResponse.json({
        error: "Certains membres actifs n'ont pas d'ordre de tirage défini. Configurez l'ordre de tirage pour tous les membres avant de démarrer un cycle.",
      }, { status: 400 });
    }

    const ordres = activeMembers.map(m => m.ordreTirage!).sort((a, b) => a - b);
    const isSequential = ordres.every((o, i) => o === i + 1);
    const isUnique = new Set(ordres).size === ordres.length;

    if (!isSequential || !isUnique) {
      return NextResponse.json({
        error: `Les ordres de tirage des membres actifs doivent être séquentiels et uniques (de 1 à ${activeMembers.length}). Corrigez-les dans les paramètres de la tontine avant de démarrer un cycle.`,
      }, { status: 400 });
    }

    // Déterminer le prochain numéro de cycle
    const dernierCycle = await prisma.tontineCycle.findFirst({
      where: { tontineId },
      orderBy: { numeroCycle: "desc" },
    });

    const nextNumeroCycle = (dernierCycle?.numeroCycle ?? 0) + 1;

    // Fix Bug 6 : vérification correcte de la fin de tontine (tous les membres ont reçu)
    if (nextNumeroCycle > activeMembers.length) {
      await prisma.$transaction(async (tx) => {
        await tx.tontine.update({
          where: { id: tontineId },
          data: { statut: StatutTontine.TERMINEE },
        });

        await tx.auditLog.create({
          data: {
            userId: parseInt(session.user.id),
            action: "CLOTURE_TONTINE",
            entite: "Tontine",
            entiteId: tontineId,
          },
        });

        const admins = await tx.user.findMany({
          where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
          select: { id: true },
        });

        if (admins.length > 0) {
          await tx.notification.createMany({
            data: admins.map((admin) => ({
              userId: admin.id,
              titre: "Tontine terminee",
              message: `Tous les membres actifs de la tontine "${tontine.nom}" ont recu le pot. La tontine est maintenant terminee.`,
              priorite: PrioriteNotification.NORMAL,
              actionUrl: `/dashboard/admin/tontines/${tontineId}`,
            })),
          });
        }
      });

      return NextResponse.json({
        message: "Tous les membres actifs ont recu le pot. La tontine est terminee.",
        tontineTerminee: true,
      });
    }

    // Trouver le bénéficiaire selon l'ordre de tirage
    // Après validation de la séquence, ce find est toujours garanti de réussir
    const beneficiaire = activeMembers.find((m) => m.ordreTirage === nextNumeroCycle)!;

    // Fix Bug 5 : pot calculé sur les membres ACTIFS uniquement
    const montantPot = new Prisma.Decimal(tontine.montantCycle).mul(activeMembers.length);

    const cycle = await prisma.$transaction(async (tx) => {
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

      // Fix Bug 5 : contributions créées pour les membres ACTIFS uniquement
      await tx.tontineContribution.createMany({
        data: activeMembers.map((m) => ({
          cycleId: created.id,
          membreId: m.id,
          montant: tontine.montantCycle,
          statut: StatutContribution.EN_ATTENTE,
        })),
      });

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

      await tx.auditLog.create({
        data: {
          userId: parseInt(session.user.id),
          action: "DEMARRAGE_CYCLE_TONTINE",
          entite: "TontineCycle",
          entiteId: created.id,
        },
      });

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
