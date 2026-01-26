import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

// ✅ GET - Liste toutes les tontines
export async function GET(req: Request) {
  // Ici, tu peux vérifier si l'user est admin si nécessaire
  // const user = await getUserFromRequest(req);
  // if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tontines = await prisma.tontine.findMany({
    include: {
      membres: {
        include: { member: true },
      },
    },
    orderBy: { dateDebut: 'desc' },
  });

  return NextResponse.json(tontines);
}

// ✅ POST - Créer une nouvelle tontine
export async function POST(req: Request) {
  const session = await getAuthSession();
  if (!session || session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { nom, description, montantCycle, frequence, dateDebut, dateFin } = await req.json();

  const tontine = await prisma.tontine.create({
    data: {
      nom,
      description,
      montantCycle,
      frequence,
      dateDebut: new Date(dateDebut),
      dateFin: dateFin ? new Date(dateFin) : null,
    },
  });

  // Optional: notification admin ou log
  await prisma.notification.create({
    data: {
      userId: parseInt(session.user.id),
      titre: 'Tontine créée',
      message: `La tontine "${nom}" a été créée avec succès.`,
    },
  });

  return NextResponse.json(tontine);
}