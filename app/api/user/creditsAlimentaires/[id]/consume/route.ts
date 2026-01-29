import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import { StatutCreditAlim, PrioriteNotification, Prisma } from '@prisma/client';

type ProduitPanier = {
  produitId: number;
  quantite: number;
};

export async function POST(req: Request) {  
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = parseInt(session.user.id);
  const { creditId, produits }: { creditId: number; produits: ProduitPanier[] } = await req.json();

  if (!produits || produits.length === 0)
    return NextResponse.json({ error: 'Aucun produit dans le panier' }, { status: 400 });

  // Vérifier crédit
  const credit = await prisma.creditAlimentaire.findUnique({ where: { id: creditId } });
  if (!credit || credit.memberId !== userId) 
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  if (credit.statut !== StatutCreditAlim.ACTIF) 
    return NextResponse.json({ error: 'Crédit non utilisable' }, { status: 400 });

  // Récupérer tous les produits
  const produitIds = produits.map(p => p.produitId);
  const produitsData = await prisma.produit.findMany({ where: { id: { in: produitIds } } });

  // Vérifier stocks et calculer le total
  let total = new Prisma.Decimal(0);
  const ventesData: { produit: typeof produitsData[0]; quantite: number }[] = [];

  for (const item of produits) {
    const produit = produitsData.find(p => p.id === item.produitId);
    if (!produit) return NextResponse.json({ error: `Produit ${item.produitId} introuvable` }, { status: 404 });
    if (produit.stock < item.quantite)
      return NextResponse.json({ error: `Stock insuffisant pour ${produit.nom}` }, { status: 400 });

    const totalProduit = new Prisma.Decimal(produit.prixUnitaire).mul(item.quantite);
    total = total.add(totalProduit);
    ventesData.push({ produit, quantite: item.quantite });
  }

  // Vérifier crédit restant
  if (total.gt(credit.plafond.minus(credit.montantUtilise)))
    return NextResponse.json({ error: 'Crédit insuffisant pour le panier' }, { status: 400 });

  // Transaction
  await prisma.$transaction(async (tx) => {
    // Vente
    for (const vente of ventesData) {
      await tx.venteCreditAlimentaire.create({
        data: {
          creditAlimentaireId: creditId,
          produitId: vente.produit.id,
          quantite: vente.quantite,
          prixUnitaire: vente.produit.prixUnitaire,
        },
      });

      // Update stock
      await tx.produit.update({
        where: { id: vente.produit.id },
        data: { stock: { decrement: vente.quantite } },
      });
    }

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

    // Notification
    await tx.notification.create({
      data: {
        userId,
        titre: 'Achat effectué',
        message: `Vous avez utilisé ${total.toFixed(2)} de votre crédit alimentaire pour ${ventesData
          .map(v => `${v.quantite}x ${v.produit.nom}`)
          .join(', ')}`,
        priorite: PrioriteNotification.NORMAL,
      },
    });
  });

  return NextResponse.json({ message: 'Achat effectué avec succès', total: total.toFixed(2) });
}