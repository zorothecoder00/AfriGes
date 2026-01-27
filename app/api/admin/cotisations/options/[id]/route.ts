import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';    
    
export async function PUT(  
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession();
  // ✅ Vérification session + rôle
  if (!session || !session.user.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await context.params;
  const { valeur } = await req.json();

  const updated = await prisma.parametre.update({   
    where: { cle: id },
    data: { valeur },
  });

  return NextResponse.json({ data: updated});
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession();
  if (!session || !session.user.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await context.params;

  await prisma.parametre.delete({ where: { cle: id } });

  return NextResponse.json({ message: 'Option supprimée' });
}