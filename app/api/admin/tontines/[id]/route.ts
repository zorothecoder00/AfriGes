import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';    
import { Frequence, StatutTontine } from '@prisma/client'

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try{
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
    const { nom, description, montantCycle, frequence, dateDebut, dateFin, statut } = body;

    const existing = await prisma.tontine.findUnique({
      where: { id: tontineId },
      include: { membres: true },   
    });

    if (!existing) {
      return NextResponse.json({ error: "Tontine introuvable" }, { status: 404 });
    }

    // 🔒 Règle métier
    if (existing.statut === StatutTontine.TERMINEE) {
      return NextResponse.json({ error: "Impossible de modifier une tontine terminée" }, { status: 400 });
    }

    if (dateDebut && dateFin && new Date(dateFin) < new Date(dateDebut)) {
      return NextResponse.json({ error: "La date de fin doit être après la date de début" }, { status: 400 });
    }

    // 🔎 Validation enum
    if (frequence && !Object.values(Frequence).includes(frequence)) {
      return NextResponse.json({ error: "Fréquence invalide" }, { status: 400 });
    }

    if (statut && !Object.values(StatutTontine).includes(statut)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }

    const updated = await prisma.tontine.update({
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

    return NextResponse.json({ data: updated });
  }catch (error) {
    console.error("PUT /admin/tontines/[id]", error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour de la tontine" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try{
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

    // 🔒 Règle métier critique
    if (tontine.membres.length > 0) {
      return NextResponse.json({ error: "Impossible de supprimer une tontine avec des membres" }, {status: 400 });
    }

    await prisma.tontine.delete({ where: { id: tontineId } });

    return NextResponse.json({ message: "Tontine supprimée avec succès" });
  }catch (error) {
    console.error("DELETE /admin/tontines/[id]", error);
    return NextResponse.json({ error: "Erreur lors de la suppression de la tontine"}, { status: 500 });
  }
}