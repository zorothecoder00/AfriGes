import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

export async function GET(req: Request) {
  const tontines = await prisma.tontine.findMany({ where: { statut: 'ACTIVE' } });
  return NextResponse.json(tontines);
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { tontineId } = await req.json();

  const participation = await prisma.tontineMembre.create({
    data: {
      tontineId,
      memberId: parseInt(session.user.id),
      dateEntree: new Date(),
    },
  });

  await prisma.notification.create({
    data: {
      userId: parseInt(session.user.id),
      titre: 'Participation à une tontine',
      message: `Vous avez rejoint la tontine #${tontineId}`,
    },
  });

  return NextResponse.json(participation);
}