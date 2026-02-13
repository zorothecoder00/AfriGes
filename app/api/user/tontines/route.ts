import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import { StatutTontine } from '@prisma/client'

export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const memberId = parseInt(session.user.id);

    const { searchParams } = new URL(req.url)

    // Pagination
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '10');
    const skip = (page - 1) * limit;

    // Tri
    const sortBy = searchParams.get('sortBy') ?? 'dateDebut';
    const order = searchParams.get('order') === 'desc' ? 'desc' : 'asc';

    const allowedSortFields = ['dateDebut', 'createdAt', 'montantCycle'];
    const orderByField = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'dateDebut';

    // Filtrer uniquement les tontines où l'utilisateur est membre
    const where = {
      statut: StatutTontine.ACTIVE,
      membres: {
        some: {
          memberId,
        },
      },
    };

    const [tontines, total] = await prisma.$transaction([
      prisma.tontine.findMany({
        where,
        orderBy: {
          [orderByField]: order,
        },
        skip,
        take: limit,
        include: {
          _count: { select: { membres: true } },
        },
      }),
      prisma.tontine.count({ where }),
    ]);

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
    console.error('Erreur lors de la récupération des tontines :', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
