import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession();
  if (!session || session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await req.json();
  const { id } = await context.params;

  const updated = await prisma.tontine.update({
    where: { id: parseInt(id) },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession();
  if (!session || session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;

  await prisma.tontine.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ message: 'Tontine supprimée' });
}