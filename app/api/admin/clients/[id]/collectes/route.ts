import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/authAdmin';

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/clients/[id]/collectes
 * Historique des collectes réalisées pour ce client.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });

    const { id } = await params;
    const clientId = Number(id);
    if (isNaN(clientId)) return NextResponse.json({ message: 'ID invalide' }, { status: 400 });

    const lignes = await prisma.ligneCollecte.findMany({
      where: { clientId },
      select: {
        id:              true,
        montantAttendu:  true,
        montantCollecte: true,
        statut:          true,
        notes:           true,
        createdAt:       true,
        collecte: {
          select: {
            id:           true,
            reference:    true,
            dateCollecte: true,
            statut:       true,
            agent: { select: { id: true, nom: true, prenom: true } },
          },
        },
        souscription: {
          select: { pack: { select: { nom: true } } },
        },
        versementPack: {
          select: {
            id:             true,
            type:           true,
            montant:        true,
            statut:         true,
            reference:      true,
            datePaiement:   true,
            encaisseParNom: true,
          },
        },
      },
      orderBy: { collecte: { dateCollecte: 'desc' } },
    });

    return NextResponse.json({ data: lignes });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Erreur collectes client' }, { status: 500 });
  }
}
