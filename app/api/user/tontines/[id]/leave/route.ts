import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import { StatutTontine, PrioriteNotification } from '@prisma/client'

export async function POST(       
  req: Request,        
  context: { params: Promise<{ id: string }> }  
) {
  try{   
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const memberId = parseInt(session.user.id);

    // 2️⃣ Récupérer l'ID de la tontine depuis l'URL
    const { id } = await context.params;
    const tontineId = parseInt(id);
    if (isNaN(tontineId)) {
      return NextResponse.json({ error: 'ID de tontine invalide' }, { status: 400 });
    }

    // 3️⃣ Vérifier que la tontine existe
    const tontine = await prisma.tontine.findUnique({
      where: { id: tontineId },
    });
    if (!tontine) {
      return NextResponse.json({ error: 'Tontine introuvable' }, { status: 404 });
    }

    if (tontine.statut !== StatutTontine.ACTIVE) {
      return NextResponse.json({ error: 'Impossible de quitter une tontine inactive' }, { status: 400 });
    }

    const now = new Date();
    if (tontine.dateDebut <= now) {
      return NextResponse.json(
        { error: 'Impossible de quitter une tontine déjà démarrée' },
        { status: 400 }
      );
    }

    // 4️⃣ Vérifier que l'utilisateur est bien membre actif
    const membership = await prisma.tontineMembre.findFirst({
      where: { tontineId, memberId, dateSortie: null },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Vous n’êtes pas membre actif de cette tontine' }, { status: 400 });
    }

    // 5️⃣ Mettre à jour la participation (quitter la tontine)
    await prisma.$transaction(async (tx) => {
      await tx.tontineMembre.update({
        where: { id: membership.id },
        data: { dateSortie: new Date() },
      });

      await tx.notification.create({
        data: {
          userId: memberId,
          titre: 'Quitter la tontine',
          message: `Vous avez quitté la tontine "${tontine.nom}".`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: `/user/tontines/${tontineId}`,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: memberId,
          action: 'LEAVE_TONTINE',
          entite: 'TONTINE',
          entiteId: tontineId,
        },
      });
    });

    // 7️⃣ Retour structuré
    return NextResponse.json({ message: 'Vous avez quitté la tontine avec succès' }, { status: 200 });
  } catch (error) {
  console.error('Erreur lors de la sortie de la tontine :', error);
  return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}