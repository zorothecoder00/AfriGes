import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const credits = await prisma.creditAlimentaire.findMany({
    where: { memberId: parseInt(session.user.id) },
    include: { ventes: true },
  });

  return NextResponse.json(credits);
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { plafond, source, sourceId } = await req.json();

  const credit = await prisma.creditAlimentaire.create({
    data: {
      memberId: parseInt(session.user.id),
      plafond,
      montantRestant: plafond,
      source,
      sourceId,
    },
  });

  await prisma.notification.create({
    data: {
      userId: parseInt(session.user.id),
      titre: 'Crédit alimentaire créé',
      message: `Vous avez un crédit alimentaire de ${plafond}`,
    },
  });

  return NextResponse.json(credit);
}