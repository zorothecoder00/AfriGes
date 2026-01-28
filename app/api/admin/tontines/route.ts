import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';   
import { Frequence } from '@prisma/client'

// ✅ GET - Liste toutes les tontines
export async function GET(req: Request) {
  
  try {
    const tontines = await prisma.tontine.findMany({
      include: {
        membres: {
        include: { member: true },
        },
      },
      orderBy: { dateDebut: "desc" },
    });

    return NextResponse.json({ data: tontines });
  } catch (error) {
    console.error("GET /admin/tontines", error);
    return NextResponse.json({ error: "Erreur lors du chargement des tontines" },{ status: 500 });
  }
}

// ✅ POST - Créer une nouvelle tontine
export async function POST(req: Request) {
  try{
    // ✅ Vérification session + rôle
    const session = await getAuthSession();
    if (!session || !session.user.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const userId = parseInt(session.user.id)

    const { nom, description, montantCycle, frequence, dateDebut, dateFin } = await req.json();

    // ✅ Validation minimale
    if (!nom || !montantCycle || !frequence || !dateDebut) {
      return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
    }

    if (!Object.values(Frequence).includes(frequence)) {
      return NextResponse.json({ error: "Fréquence invalide" }, { status: 400 });
    }

    const tontine = await prisma.$transaction(async (tx) => {
      const created = await tx.tontine.create({
        data: {
          nom,
          description,
          montantCycle,
          frequence,
          dateDebut: new Date(dateDebut),
          dateFin: dateFin ? new Date(dateFin) : null,
        },
      });

      await tx.notification.create({
        data: {
          userId,
          titre: "Tontine créée",
          message: `La tontine "${nom}" a été créée avec succès.`,
        },
      });

      return created;
    });

    return NextResponse.json({ data: tontine }, { status: 201 });

  } catch (error) {
    console.error("POST /admin/tontines", error);
    return NextResponse.json({ error: "Erreur lors de la création de la tontine" }, { status: 500 });
  }
}