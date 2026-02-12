import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const tontineId = parseInt(id);

    if (isNaN(tontineId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
    }

    const memberId = parseInt(session.user.id);

    // Vérifier que l'utilisateur est membre de cette tontine
    const membership = await prisma.tontineMembre.findFirst({
      where: {
        tontineId,
        memberId,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Vous ne faites pas partie de cette tontine' },
        { status: 403 }
      );
    }

    // Récupérer la tontine avec tous ses membres
    const tontine = await prisma.tontine.findUnique({
      where: { id: tontineId },
      include: {
        membres: {
          include: {
            member: {
              select: {
                id: true,
                nom: true,
                prenom: true,
                photo: true,
              },
            },
          },
          orderBy: { ordreTirage: 'asc' },
        },
      },
    });

    if (!tontine) {
      return NextResponse.json({ error: 'Tontine introuvable' }, { status: 404 });
    }

    return NextResponse.json({ data: tontine });
  } catch (error) {
    console.error('GET /user/tontines/[id]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
