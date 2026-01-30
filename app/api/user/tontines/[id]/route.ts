import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    // 1️⃣ Vérifier la session
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const memberId = parseInt(session.user.id);

    const { searchParams } = new URL(req.url);

    // 2️⃣ Pagination
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '10');
    const skip = (page - 1) * limit;

    // 3️⃣ Tri
    const sortBy = searchParams.get('sortBy') ?? 'dateDebut';
    const order = searchParams.get('order') === 'desc' ? 'desc' : 'asc';

    const allowedSortFields = ['dateDebut', 'createdAt', 'montantCycle'];
    const orderByField = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'dateDebut';

    // 4️⃣ Requête via la table pivot
    const [tontines, total] = await prisma.$transaction([
      prisma.tontine.findMany({
        where: {
          membres: {
            some: {
              memberId,
            },
          },
        },
        orderBy: {
          [orderByField]: order,
        },
        skip,
        take: limit,
        include: {
          membres: {
            where: { memberId },
            select: {
              ordreTirage: true,
              dateEntree: true,
              dateSortie: true,
            },
          },
        },
      }),
      prisma.tontine.count({
        where: {
          membres: {
            some: {
              memberId,
            },
          },
        },
      }),
    ]);

    // 5️⃣ Retour structuré
    return NextResponse.json({
      data: tontines,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des tontines utilisateur :', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
