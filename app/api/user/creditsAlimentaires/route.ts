import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import { StatutCreditAlim } from '@prisma/client';

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = parseInt(session.user.id);

  const credits = await prisma.creditAlimentaire.findMany({
    where: {
      memberId: userId,
      statut: StatutCreditAlim.ACTIF, // ✅ seuls les crédits actifs
    },
    include: {
      ventes: {
        include: { produit: true }, // détails produits pour chaque vente
      },
    },
    orderBy: { dateAttribution: 'desc' },
    take: 50, // limiter à 50 résultats par défaut
  });

  return NextResponse.json({ data: credits });
}
   
