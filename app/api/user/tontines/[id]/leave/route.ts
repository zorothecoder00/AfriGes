import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const tontineId = parseInt(id);
  await prisma.tontineMembre.updateMany({
    where: { tontineId, memberId: parseInt(session.user.id), dateSortie: null },
    data: { dateSortie: new Date() },
  });

  await prisma.notification.create({
    data: {
      userId: parseInt(session.user.id),
      titre: 'Quitter tontine',
      message: `Vous avez quitté la tontine #${tontineId}`,
    },
  });

  return NextResponse.json({ message: 'Tontine quittée' });
}