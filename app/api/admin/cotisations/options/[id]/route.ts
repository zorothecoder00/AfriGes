import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';    
    
export async function PUT(  
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession();
  if (!session || session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const { valeur } = await req.json();

  const updated = await prisma.parametre.update({   
    where: { cle: id },
    data: { valeur },
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

  await prisma.parametre.delete({ where: { cle: id } });

  return NextResponse.json({ message: 'Option supprimée' });
}