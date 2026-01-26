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
  const already = await prisma.tontineMembre.findFirst({ where: { tontineId, memberId: parseInt(session.user.id) } });
  if (already) return NextResponse.json({ error: 'Déjà membre' }, { status: 400 });

  const participation = await prisma.tontineMembre.create({
    data: { tontineId, memberId: parseInt(session.user.id), dateEntree: new Date() },
  });

  await prisma.notification.create({
    data: {
      userId: parseInt(session.user.id),
      titre: 'Rejoint la tontine',
      message: `Vous avez rejoint la tontine #${tontineId}`,
    },
  });

  return NextResponse.json(participation);
}