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

  return NextResponse.json({ data: credits });
}
   
