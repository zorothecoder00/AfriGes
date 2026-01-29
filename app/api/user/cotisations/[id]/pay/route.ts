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

    if (cotisation.statut === 'PAYEE')
      return NextResponse.json({ error: 'Cotisation déjà payée' }, { status: 400 });

    // Vérifier le wallet
    const wallet = await prisma.wallet.findUnique({ where: { memberId } });
    if (!wallet) return NextResponse.json({ error: 'Wallet introuvable' }, { status: 404 });

    if (wallet.soldeGeneral.lt(cotisation.montant))
      return NextResponse.json({ error: 'Solde insuffisant' }, { status: 400 });

    // Créer la facture en dehors du transaction
    const facture = await prisma.facture.create({
      data: {
        memberId,
        montant: cotisation.montant,
        type: 'COTISATION',
        statut: 'PAYEE',
        reference: `FACTURE-${Date.now()}`,
      },
    });

    // Créer la transaction atomique
    const reference = `COTISATION-${cotisation.id}-${Date.now()}`;

    await prisma.$transaction([
      // Débiter le wallet
      prisma.wallet.update({
        where: { memberId },
        data: { soldeGeneral: { decrement: cotisation.montant } },
      }),
      // Ajouter la transaction dans WalletTransaction
      prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'COTISATION',
          montant: cotisation.montant,
          description: `Paiement cotisation #${cotisation.id}`,
          reference,
        },
      }),
      // Ajouter le paiement pour l’historique
      prisma.paiement.create({
        data: {
          walletId: wallet.id,
          factureId: facture.id, // OK, facture.id est défini
          montant: cotisation.montant,
          type: 'WALLET_GENERAL',
          reference,
        },
      }),

      // Mettre à jour le statut de la cotisation
      prisma.cotisation.update({
        where: { id: cotisation.id },
        data: { statut: 'PAYEE' },
      }),
      // Créer une notification
      prisma.notification.create({   
        data: {
          userId: memberId,
          titre: 'Cotisation payée',
          message: `Votre cotisation de ${cotisation.montant} a été réglée avec succès.`,
        },
      }),
    ]);

    return NextResponse.json({ success: true, message: 'Cotisation payée avec succès' });
  } catch (error) {
    console.error('POST /cotisations/[id]/pay error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}