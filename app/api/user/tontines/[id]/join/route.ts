import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import { StatutTontine, PrioriteNotification, Prisma } from '@prisma/client'
      
export async function POST(      
  req: Request,     
  context: { params: Promise<{ id: string }> }
) {     
  try {      
    // 1️⃣ Vérifier session utilisateur
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const memberId = parseInt(session.user.id);  
    const now = new Date();

    // 2️⃣ Récupérer l'ID de la tontine depuis l'URL
    const { id } = await context.params;
    const tontineId = parseInt(id);
    if (isNaN(tontineId)) {
      return NextResponse.json({ error: 'ID de tontine invalide' }, { status: 400 });
    }

    // 3️⃣ Vérifier que la tontine existe et est ACTIVE
    const tontine = await prisma.tontine.findUnique({
      where: { id: tontineId },
    });
    if (!tontine || tontine.statut !== StatutTontine.ACTIVE) {
      return NextResponse.json({ error: 'Tontine introuvable ou inactive' }, { status: 404 });
    }

    // 4️⃣ Vérifications métier (statut + dates)
    if (tontine.statut !== StatutTontine.ACTIVE) {
      return NextResponse.json(
        { error: 'Cette tontine n’est pas active' },
        { status: 400 }
      );
    }

    if (tontine.dateDebut <= now) {
      return NextResponse.json(
        { error: 'Cette tontine a déjà commencé' },
        { status: 400 }
      );
    }

    if (tontine.dateFin && tontine.dateFin < now) {
      return NextResponse.json(
        { error: 'Cette tontine est déjà terminée' },
        { status: 400 }
      );
    }

    // 4️⃣ Vérifier si l'utilisateur est déjà membre
    const existing = await prisma.tontineMembre.findFirst({
      where: { tontineId, memberId },
    });
    if (existing) {
      return NextResponse.json({ error: 'Vous êtes déjà membre de cette tontine' }, { status: 400 });
    }

    // 5️⃣ Créer la participation
    const participation = await prisma.$transaction(async (tx) => {
      const participation = await tx.tontineMembre.create({
        data: {
          tontineId,
          memberId,
          dateEntree: now,
        },
        include: { tontine: true },
      });

      await tx.notification.create({
        data: {
          userId: memberId,
          titre: 'Participation à une tontine',
          message: `Vous avez rejoint la tontine "${tontine.nom}" qui débute le ${tontine.dateDebut.toLocaleDateString()}.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: `/user/tontines/${tontineId}`,
        },
      });

      return participation;
    });

    // 7️⃣ Retour structuré
    return NextResponse.json({ data: participation }, { status: 201 });
  } catch (error) {
  console.error('Erreur lors de la participation à la tontine :', error);

  // 🎯 Gestion future de l’unicité DB (P2002)
  // ✅ Narrowing TypeScript
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
     return NextResponse.json({ error: 'Vous êtes déjà membre de cette tontine' }, { status: 400 });
  }

  return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}