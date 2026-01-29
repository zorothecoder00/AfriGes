import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import { StatutTontine, PrioriteNotification } from '@prisma/client'

export async function GET(req: Request) {     
  try {
    const tontines = await prisma.tontine.findMany({
      where: { statut: 'ACTIVE' },
      orderBy: { dateDebut: 'asc' }, // tri par date de début
    });

    return NextResponse.json({ data: tontines });
  } catch (error) {
    console.error('Erreur lors de la récupération des tontines :', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try{
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { tontineId } = await req.json();
    const memberId = parseInt(session.user.id);

    // Vérifier si la tontine existe et est ACTIVE
    const tontine = await prisma.tontine.findUnique({
      where: { id: tontineId },
    });
    if (!tontine || tontine.statut !== 'ACTIVE') {
      return NextResponse.json({ error: 'Tontine introuvable ou inactive' }, { status: 404 });
    }


    // Vérifier si l'utilisateur a déjà rejoint cette tontine
    const existing = await prisma.tontineMembre.findFirst({
      where: { tontineId, memberId },
    });
    if (existing) {
      return NextResponse.json({ error: 'Vous avez déjà rejoint cette tontine' }, { status: 400 });
    }

    const participation = await prisma.tontineMembre.create({
      data: {
        tontineId,
        memberId,
        dateEntree: new Date(),
      },
      include: { tontine: true }, // Renvoie aussi les infos de la tontine
    });

    await prisma.notification.create({
      data: {
        userId: memberId,
        titre: 'Participation à une tontine',
        message: `Vous avez rejoint la tontine "${tontine.nom}"`,
        priorite: PrioriteNotification.NORMAL,
      },
    });

    return NextResponse.json({ data: participation }, { status: 201 });
  } catch (error) {
  console.error('Erreur lors de la participation à la tontine :', error);
  return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}