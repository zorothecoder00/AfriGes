import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth'; // fonction pour récupérer user connecté
import { Prisma, PeriodeCotisation, StatutCotisation, PrioriteNotification  } from '@prisma/client'

export async function GET(req: Request) {           

  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const memberId = parseInt(session.user.id)

    const cotisations = await prisma.cotisation.findMany({
      where: { memberId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        montant: true,
        periode: true,
        statut: true,
        datePaiement: true,
        dateExpiration: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: cotisations });
  } catch (error) {
    console.error('GET /cotisations error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const memberId = parseInt(session.user.id)

    const body = await req.json();
    const { montant, periode } = body;

    // Validation
    if (!montant || isNaN(montant) || montant <= 0) {
      return NextResponse.json({ error: 'Montant invalide' }, { status: 400 });
    }

    if (!Object.values(PeriodeCotisation).includes(periode))
      return NextResponse.json({ error: 'Période invalide' }, { status: 400 });

    /* =======================
       RÈGLE MÉTIER :
       Une seule cotisation active
    ======================= */

    const cotisationActive = await prisma.cotisation.findFirst({
      where: {
        memberId,
        statut: {
          in: [
            StatutCotisation.EN_ATTENTE,
            StatutCotisation.PAYEE,
          ],
        },
        dateExpiration: {
          gt: new Date(),
        },
      },
    });

    if (cotisationActive) {
      return NextResponse.json({ error: 'Une cotisation active existe déjà. Vous ne pouvez pas en créer une nouvelle.'}, { status: 400 });
    }

    /* =======================
       CALCUL DES DATES
    ======================= */

    const now = new Date();

    const dateExpiration =
      periode === PeriodeCotisation.MENSUEL
        ? new Date(new Date().setMonth(now.getMonth() + 1))
        : new Date(new Date().setFullYear(now.getFullYear() + 1));


    const cotisation = await prisma.cotisation.create({
      data: {
        memberId,
        montant: new Prisma.Decimal(montant),
        periode,
        statut: StatutCotisation.EN_ATTENTE,
        datePaiement: null, // ✅ PAS PAYÉ
        dateExpiration,
      },
    });

    // Notification
    await prisma.notification.create({
      data: {   
        userId: memberId,
        titre: 'Cotisation créée',
        message: `Votre cotisation de ${montant} a été créée et est en attente de paiement.`,
      },
    });

    return NextResponse.json({ success: true, data: cotisation });
  } catch (error) {
  console.error('POST /cotisations error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}