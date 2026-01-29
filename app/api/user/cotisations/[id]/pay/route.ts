import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import { StatutCotisation, TypeFacture, StatutFacture, TypePaiement, TransactionType, PrioriteNotification } from '@prisma/client'

export async function POST(    
  req: Request,    
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const cotisationId = parseInt(id);
    const memberId = parseInt(session.user.id);

    // Récupérer la cotisation
    const cotisation = await prisma.cotisation.findUnique({ where: { id: cotisationId } });
    if (!cotisation || cotisation.memberId !== memberId)
      return NextResponse.json({ error: 'Cotisation introuvable ou accès interdit' }, { status: 403 });

    if (cotisation.statut !== StatutCotisation.EN_ATTENTE) {
      return NextResponse.json({ error: 'Cette cotisation ne peut plus être payée' }, { status: 400 });
    }

    if (cotisation.dateExpiration <= new Date()) {
      return NextResponse.json({ error: 'Cette cotisation est expirée' }, { status: 400 });
    }

    // Vérifier le wallet
    const wallet = await prisma.wallet.findUnique({ where: { memberId } });
    if (!wallet) return NextResponse.json({ error: 'Wallet introuvable' }, { status: 404 });

    if (wallet.soldeGeneral.lt(cotisation.montant))
      return NextResponse.json({ error: 'Solde insuffisant' }, { status: 400 });

    // Créer la transaction atomique
    await prisma.$transaction(async (tx) => {
      const reference = `COTISATION-${cotisation.id}-${Date.now()}`;

      // 1️⃣ Facture (obligatoire en premier)
      const facture = await tx.facture.create({
        data: {
          memberId,
          montant: cotisation.montant,
          type: TypeFacture.COTISATION,
          statut: StatutFacture.PAYEE,
          reference: `FACT-${reference}`,
        },
      });

      // 2️⃣ Débit wallet
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          soldeGeneral: { decrement: cotisation.montant },
        },
      });

      // 3️⃣ Cotisation payée
      await tx.cotisation.update({
        where: { id: cotisation.id },
        data: {
          statut: StatutCotisation.PAYEE,
          datePaiement: new Date(),
        },
      });

      // 4️⃣ Opérations NON critiques → PARALLÈLE
      await Promise.all([
        tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: TransactionType.COTISATION,
            montant: cotisation.montant,
            description: `Paiement cotisation #${cotisation.id}`,
            reference,
          },
        }),

        tx.paiement.create({
          data: {
            walletId: wallet.id,
            factureId: facture.id,
            montant: cotisation.montant,
            type: TypePaiement.WALLET_GENERAL,
            reference,
          },
        }),

        tx.notification.create({
          data: {    
            userId: memberId,
            titre: 'Cotisation payée',
            message: `Votre cotisation de ${cotisation.montant} a été réglée avec succès.`,
          },
        }),
      ]);
    });

    return NextResponse.json({ success: true, message: 'Cotisation payée avec succès' });
  } catch (error) {
    console.error('POST /cotisations/[id]/pay error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}