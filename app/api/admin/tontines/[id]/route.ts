import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import { Frequence, StatutTontine, StatutCycle } from '@prisma/client'

/**
 * ==========================
 * GET /admin/tontines/[id]
 * ==========================
 * Lire une tontine specifique
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Fix Bug 1 : auth manquant sur GET
    const session = await getAuthSession();
    if (!session || !session.user.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { id } = await context.params;
    const tontineId = parseInt(id);

    if (isNaN(tontineId)) {
      return NextResponse.json({ message: "ID invalide" }, { status: 400 });
    }

    const tontine = await prisma.tontine.findUnique({
      where: { id: tontineId },
      include: {
        membres: {
          include: {
            client: {
              select: {
                id: true,
                nom: true,
                prenom: true,
                telephone: true,
              },
            },
          },
          orderBy: { ordreTirage: 'asc' },
        },
        cycles: {
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
              orderBy: { membre: { ordreTirage: 'asc' } },
            },
          },
          orderBy: { numeroCycle: 'desc' },
        },
        _count: { select: { membres: true } },
      },
    });

    if (!tontine) {
      return NextResponse.json({ message: "Tontine introuvable" }, { status: 404 });
    }

    return NextResponse.json({ data: tontine });
  } catch (error) {
    console.error("GET /admin/tontines/[id]", error);
    return NextResponse.json({ message: "Erreur lors de la recuperation de la tontine" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session || !session.user.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await context.params;
    const tontineId = parseInt(id)

    if (isNaN(tontineId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const body = await req.json();
    const { nom, description, montantCycle, frequence, dateDebut, dateFin, statut, membres } = body;

    const existing = await prisma.tontine.findUnique({
      where: { id: tontineId },
      include: { membres: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Tontine introuvable" }, { status: 404 });
    }

    // Règle métier : tontine terminée non modifiable
    if (existing.statut === StatutTontine.TERMINEE) {
      return NextResponse.json({ error: "Impossible de modifier une tontine terminée" }, { status: 400 });
    }

    if (dateDebut && dateFin && new Date(dateFin) < new Date(dateDebut)) {
      return NextResponse.json({ error: "La date de fin doit être après la date de début" }, { status: 400 });
    }

    if (frequence && !Object.values(Frequence).includes(frequence)) {
      return NextResponse.json({ error: "Fréquence invalide" }, { status: 400 });
    }

    if (statut && !Object.values(StatutTontine).includes(statut)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }

    // Fix Bug 2 : bloquer la modification des membres si des cycles existent
    if (Array.isArray(membres)) {
      const cyclesCount = await prisma.tontineCycle.count({ where: { tontineId } });
      if (cyclesCount > 0) {
        return NextResponse.json({
          error: "Impossible de modifier les membres d'une tontine qui a déjà des cycles enregistrés. La composition des membres est figée une fois les cycles démarrés.",
        }, { status: 400 });
      }
    }

    // Fix Bug 3 : bloquer la modification du montantCycle pendant un cycle EN_COURS
    if (montantCycle !== undefined && Number(montantCycle) !== Number(existing.montantCycle)) {
      const cycleEnCours = await prisma.tontineCycle.findFirst({
        where: { tontineId, statut: StatutCycle.EN_COURS },
      });
      if (cycleEnCours) {
        return NextResponse.json({
          error: `Impossible de modifier le montant du cycle pendant qu'un cycle est en cours (cycle n°${cycleEnCours.numeroCycle}). Clôturez d'abord le cycle actuel.`,
        }, { status: 400 });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Mettre à jour les infos de la tontine
      const tontine = await tx.tontine.update({
        where: { id: tontineId },
        data: {
          nom,
          description,
          montantCycle,
          frequence,
          statut,
          dateDebut: dateDebut ? new Date(dateDebut) : undefined,
          dateFin: dateFin ? new Date(dateFin) : undefined,
        },
      });

      // Synchroniser les membres si fournis (et cycles=0, vérifié avant)
      if (Array.isArray(membres)) {
        await tx.tontineMembre.deleteMany({
          where: { tontineId },
        });

        if (membres.length > 0) {
          await tx.tontineMembre.createMany({
            data: membres.map((m: { clientId: number; ordreTirage: number | null }) => ({
              tontineId,
              clientId: m.clientId,
              ordreTirage: m.ordreTirage,
            })),
          });
        }
      }

      return tontine;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PUT /admin/tontines/[id]", error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour de la tontine" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session || !session.user.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await context.params;
    const tontineId = parseInt(id)

    if (isNaN(tontineId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const tontine = await prisma.tontine.findUnique({
      where: { id: tontineId },
      include: { membres: true },
    });

    if (!tontine) {
      return NextResponse.json({ error: "Tontine introuvable" }, { status: 404 });
    }

    // Fix Bug 4 : vérifier l'existence de cycles avant la suppression
    const cyclesCount = await prisma.tontineCycle.count({ where: { tontineId } });
    if (cyclesCount > 0) {
      return NextResponse.json({
        error: `Impossible de supprimer cette tontine : elle possède ${cyclesCount} cycle(s) enregistré(s). Seules les tontines sans cycles peuvent être supprimées.`,
      }, { status: 400 });
    }

    if (tontine.membres.length > 0) {
      return NextResponse.json({ error: "Impossible de supprimer une tontine avec des membres" }, { status: 400 });
    }

    await prisma.tontine.delete({ where: { id: tontineId } });

    return NextResponse.json({ message: "Tontine supprimée avec succès" });
  } catch (error) {
    console.error("DELETE /admin/tontines/[id]", error);
    return NextResponse.json({ error: "Erreur lors de la suppression de la tontine" }, { status: 500 });
  }
}
