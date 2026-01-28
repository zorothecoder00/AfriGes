import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import { Prisma, SourceCreditAlim } from "@prisma/client";
   
export async function POST(req: Request) {             
  
  try {
    const session = await getAuthSession()
    // ✅ Vérification session + rôle
    if (!session || !session.user.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { memberId, plafond, source, sourceId, dateExpiration } = await req.json();

    // Vérification simple des données
    if (!memberId || !plafond || !source || !sourceId) {
      return NextResponse.json({ error: 'Tous les champs obligatoires doivent être fournis.' }, { status: 400 });
    }

    if (plafond <= 0) {
      return NextResponse.json({ error: "Le plafond doit être supérieur à 0" }, { status: 400 });
    }

    if (!Object.values(SourceCreditAlim).includes(source)) {
      return NextResponse.json({ error: `Source invalide. Doit être l'une de: ${Object.values(SourceCreditAlim).join(', ')}` }, { status: 400 });
    }

    const plafondDecimal = new Prisma.Decimal(plafond);

    // Créer le crédit alimentaire
    const credit = await prisma.creditAlimentaire.create({
      data: {
        memberId,
        plafond: plafondDecimal,
        montantUtilise: new Prisma.Decimal(0),
        montantRestant: plafondDecimal, // Par défaut égal au plafond
        source: source as SourceCreditAlim,
        sourceId,
        dateExpiration: dateExpiration ? new Date(dateExpiration) : null, // optionnel
      },
    });

    return NextResponse.json({ data: credit }, { status: 201 });
  } catch (error) {
  console.error('Erreur lors de la création du crédit alimentaire:', error);
    return NextResponse.json({ error: 'Erreur serveur lors de la création du crédit alimentaire.' }, { status: 500 });
  }
}