import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
  
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
    if (!tontine || tontine.statut !== 'ACTIVE') {
      return NextResponse.json({ error: 'Tontine introuvable ou inactive' }, { status: 404 });
    }

    // 4️⃣ Vérifier si l'utilisateur est déjà membre
    const existing = await prisma.tontineMembre.findFirst({
      where: { tontineId, memberId },
    });
    if (existing) {
      return NextResponse.json({ error: 'Vous êtes déjà membre de cette tontine' }, { status: 400 });
    }

    // 5️⃣ Créer la participation
    const participation = await prisma.tontineMembre.create({
      data: {
        tontineId,
        memberId,
        dateEntree: new Date(),
      },
      include: { tontine: true }, // renvoie aussi les infos de la tontine
    });

    // 6️⃣ Créer une notification complète
    await prisma.notification.create({
      data: {
        userId: memberId,
        titre: 'Participation à une tontine',
        message: `Vous avez rejoint la tontine "${tontine.nom}" qui commence le ${tontine.dateDebut.toLocaleDateString()}.`,
        priorite: 'NORMAL',
        actionUrl: `/user/tontines/${tontineId}`, // lien vers la tontine
      },
    });

    // 7️⃣ Retour structuré
    return NextResponse.json({ data: participation }, { status: 201 });
  } catch (error) {
  console.error('Erreur lors de la participation à la tontine :', error);
  return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}