import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth'; // fonction pour récupérer user connecté
import { Prisma } from '@prisma/client'

export async function GET(req: Request) {      

  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const memberId = parseInt(session.user.id)

    const cotisations = await prisma.cotisation.findMany({
      where: { memberId },
      orderBy: { datePaiement: 'desc' },
      select: {
      id: true,
      montant: true,
      periode: true,
      statut: true,
      datePaiement: true,
      dateExpiration: true,
      createdAt: true,
      },
    });

    return NextResponse.json({ data: cotisations });
  } catch (error) {
    console.error('GET /cotisations error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const memberId = parseInt(session.user.id)

    const body = await req.json();
    const { montant, periode } = body;

    // Validation
    if (!montant || isNaN(montant) || montant <= 0) {
      return NextResponse.json({ error: 'Montant invalide' }, { status: 400 });
    }

    if (!periode || !['MENSUEL', 'ANNUEL'].includes(periode))
      return NextResponse.json({ error: 'Période invalide' }, { status: 400 });

    const datePaiement = new Date();
    const dateExpiration =
      periode === 'MENSUEL'
        ? new Date(new Date().setMonth(datePaiement.getMonth() + 1))
        : new Date(new Date().setFullYear(datePaiement.getFullYear() + 1));

    const cotisation = await prisma.cotisation.create({
      data: {
        memberId,
        montant: new Prisma.Decimal(montant),
        periode,
        datePaiement,
        dateExpiration,
        statut: 'EN_ATTENTE', // paiement non effectué
      },
    });

    // Notification
    await prisma.notification.create({
      data: {   
        userId: memberId,
        titre: 'Cotisation créée',
        message: `Votre cotisation de ${montant} a été créée et est en attente de paiement.`,
      },
    });

    return NextResponse.json({ success: true, data: cotisation });
  } catch (error) {
  console.error('POST /cotisations error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}