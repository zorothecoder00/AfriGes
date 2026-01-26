import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';          
     
export async function GET(req: Request) {     
  const session = await getAuthSession();
  if (!session || session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const options = await prisma.parametre.findMany({
    where: { cle: { startsWith: 'cotisation_' } },
  });

  return NextResponse.json(options);
}

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session || session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cle, valeur } = await req.json();
  const option = await prisma.parametre.create({ data: { cle, valeur } });

  return NextResponse.json(option);
}