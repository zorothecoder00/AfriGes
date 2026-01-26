import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { creditId, produitId, quantite } = await req.json();

  const credit = await prisma.creditAlimentaire.findUnique({ where: { id: creditId } });
  if (!credit || credit.memberId !== parseInt(session.user.id)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

  const produit = await prisma.produit.findUnique({ where: { id: produitId } });
  if (!produit || produit.stock < quantite) return NextResponse.json({ error: 'Stock insuffisant' }, { status: 400 });

  const total = produit.prixUnitaire.mul(quantite);

  if (total.gt(credit.montantRestant)) return NextResponse.json({ error: 'Crédit insuffisant' }, { status: 400 });

  await prisma.$transaction([
    prisma.venteCreditAlimentaire.create({
      data: { creditAlimentaireId: creditId, produitId, quantite, prixUnitaire: produit.prixUnitaire },
    }),
    prisma.creditAlimentaire.update({
      where: { id: creditId },
      data: {
        montantUtilise: { increment: total },
        montantRestant: { decrement: total },
      },
    }),
    prisma.produit.update({
      where: { id: produitId },
      data: { stock: { decrement: quantite } },
    }),
    prisma.notification.create({
      data: {
        userId: parseInt(session.user.id),
        titre: 'Achat effectué',
        message: `Vous avez utilisé ${total} de votre crédit alimentaire pour ${quantite}x ${produit.nom}`,
      },
    }),
  ]);

  return NextResponse.json({ message: 'Achat effectué avec succès' });
}