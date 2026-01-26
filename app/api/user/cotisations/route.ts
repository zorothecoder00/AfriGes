import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth'; // fonction pour récupérer user connecté
import { Prisma } from '@prisma/client'

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cotisations = await prisma.cotisation.findMany({
    where: { memberId: parseInt(session.user.id) },
  });

  return NextResponse.json(cotisations);
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { montant, periode } = body;

  const cotisation = await prisma.cotisation.create({
    data: {
      memberId: parseInt(session.user.id),
      montant: new Prisma.Decimal(montant),
      periode,
      datePaiement: new Date(),
      dateExpiration: periode === 'MENSUEL'
        ? new Date(new Date().setMonth(new Date().getMonth() + 1))
        : new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
      statut: 'PAYEE', // si paiement direct, sinon EN_ATTENTE
    },
  });

  // Notification
  await prisma.notification.create({
    data: {
      userId: parseInt(session.user.id),
      titre: 'Cotisation créée',
      message: `Votre cotisation de ${montant} a été créée`,
    },
  });

  return NextResponse.json(cotisation);
}