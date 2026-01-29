import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import { StatutCreditAlim, PrioriteNotification, Prisma } from '@prisma/client';

export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = parseInt(session.user.id);
  const { creditId, produitId, quantite } = await req.json();

  // Vérifier crédit
  const credit = await prisma.creditAlimentaire.findUnique({ where: { id: creditId } });
  if (!credit || credit.memberId !== userId) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  if (credit.statut !== StatutCreditAlim.ACTIF) return NextResponse.json({ error: 'Crédit non utilisable' }, { status: 400 });

  // Vérifier produit
  const produit = await prisma.produit.findUnique({ where: { id: produitId } });
  if (!produit || produit.stock < quantite) return NextResponse.json({ error: 'Stock insuffisant' }, { status: 400 });

  // Calcul du total
  const total = new Prisma.Decimal(produit.prixUnitaire).mul(quantite);
  if (total.gt(credit.plafond.minus(credit.montantUtilise))) return NextResponse.json({ error: 'Crédit insuffisant' }, { status: 400 });

  // Transaction
  await prisma.$transaction(async (tx) => {
    // Vente
    await tx.venteCreditAlimentaire.create({
      data: {
        creditAlimentaireId: creditId,
        produitId,
        quantite,
        prixUnitaire: produit.prixUnitaire,
      },
    });

    // Update crédit
    const nouveauMontantUtilise = credit.montantUtilise.add(total);
    const nouveauMontantRestant = credit.plafond.sub(nouveauMontantUtilise);
    await tx.creditAlimentaire.update({
      where: { id: creditId },
      data: {
        montantUtilise: { increment: total },
        montantRestant: nouveauMontantRestant,
        statut: nouveauMontantRestant.lte(0) ? StatutCreditAlim.EPUISE : StatutCreditAlim.ACTIF,
      },
    });

    // Update stock
    await tx.produit.update({
      where: { id: produitId },
      data: { stock: { decrement: quantite } },
    });

    // Notification
    await tx.notification.create({
      data: {
        userId,
        titre: 'Achat effectué',
        message: `Vous avez utilisé ${total.toFixed(2)} de votre crédit alimentaire pour ${quantite}x ${produit.nom}`,
        priorite: PrioriteNotification.NORMAL,
      },
    });
  });

  return NextResponse.json({ message: 'Achat effectué avec succès' });
}