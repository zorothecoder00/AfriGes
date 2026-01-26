import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
   
export async function POST(req: Request) {     
  
  const session = await getAuthSession()
  if (!session || session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { memberId, plafond, source, sourceId } = await req.json();

  const credit = await prisma.creditAlimentaire.create({
    data: { memberId, plafond, montantRestant: plafond, source, sourceId },
  });

  return NextResponse.json({ data: credit });
}