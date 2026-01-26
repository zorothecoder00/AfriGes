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

  const cotisation = await prisma.cotisation.findUnique({ where: { id: parseInt(id) } });
  if (!cotisation || cotisation.memberId !== parseInt(session.user.id)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

  const wallet = await prisma.wallet.findUnique({ where: { memberId: parseInt(session.user.id) } });
  if (!wallet || wallet.soldeGeneral.lt(cotisation.montant)) return NextResponse.json({ error: 'Solde insuffisant' }, { status: 400 });

  await prisma.$transaction([
    prisma.wallet.update({  
      where: { memberId: parseInt(session.user.id) },
      data: { soldeGeneral: { decrement: cotisation.montant } },
    }),
    prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'COTISATION',
        montant: cotisation.montant,
        description: `Paiement cotisation #${cotisation.id}`,
        reference: `COTISATION-${cotisation.id}-${Date.now()}`,
      },
    }),
    prisma.cotisation.update({
      where: { id: cotisation.id },
      data: { statut: 'PAYEE' },
    }),
    prisma.notification.create({
      data: {
        userId: parseInt(session.user.id),
        titre: 'Cotisation payée',
        message: `Votre cotisation de ${cotisation.montant} a été réglée avec succès`,
      },
    }),
  ]);

  return NextResponse.json({ message: 'Cotisation payée avec succès' });
}