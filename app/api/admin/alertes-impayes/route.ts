import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/authAdmin';

/**
 * GET /api/admin/alertes-impayes
 * Clients avec échéances dépassées depuis plus de X jours
 * ?jours=30&search=&agentId=&page=1&limit=20
 */
export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const jours    = Math.max(1, Number(searchParams.get('jours') || 30));
    const search   = (searchParams.get('search') || '').trim();
    const agentId  = searchParams.get('agentId');
    const page     = Number(searchParams.get('page') || 1);
    const limit    = Number(searchParams.get('limit') || 20);
    const skip     = (page - 1) * limit;

    const now       = new Date();
    const cutoff    = new Date(now.getTime() - jours * 24 * 60 * 60 * 1000);

    const where: Prisma.SouscriptionPackWhereInput = {
      montantRestant: { gt: 0 },
      echeances: { some: { datePrevue: { lt: cutoff }, statut: 'EN_ATTENTE' } },
      ...(agentId && { client: { agentTerrainId: Number(agentId) } }),
      ...(search && {
        client: {
          OR: [
            { nom:       { contains: search, mode: 'insensitive' } },
            { prenom:    { contains: search, mode: 'insensitive' } },
            { telephone: { contains: search, mode: 'insensitive' } },
          ],
        },
      }),
    };

    const [creances, total, stats] = await Promise.all([
      prisma.souscriptionPack.findMany({
        where,
        skip,
        take: limit,
        orderBy: { montantRestant: 'desc' },
        select: {
          id: true,
          montantTotal:   true,
          montantVerse:   true,
          montantRestant: true,
          statut:         true,
          pack: { select: { id: true, nom: true, type: true } },
          client: {
            select: {
              id: true, nom: true, prenom: true,
              telephone: true, codeClient: true, segment: true,
              tags: { select: { tag: { select: { id: true, nom: true, couleur: true } } } },
              agentTerrain: { select: { id: true, nom: true, prenom: true } },
              pointDeVente: { select: { id: true, nom: true, code: true } },
            },
          },
          echeances: {
            where: { statut: 'EN_ATTENTE' },
            orderBy: { datePrevue: 'asc' },
            select: { id: true, datePrevue: true, montant: true, statut: true },
          },
        },
      }),

      prisma.souscriptionPack.count({ where }),

      prisma.souscriptionPack.aggregate({
        where,
        _sum:   { montantRestant: true },
        _count: { id: true },
      }),
    ]);

    // Calcul jours de retard (plus ancienne échéance dépassée par souscription)
    const result = creances.map((c) => {
      const echeancesDepassees = c.echeances.filter(
        (e) => new Date(e.datePrevue) < cutoff
      );
      const plusAncienne = echeancesDepassees[0] ?? null;
      const joursRetard  = plusAncienne
        ? Math.floor((now.getTime() - new Date(plusAncienne.datePrevue).getTime()) / 86400000)
        : 0;

      return {
        ...c,
        montantRestant:    Number(c.montantRestant),
        montantTotal:      Number(c.montantTotal),
        montantVerse:      Number(c.montantVerse),
        nbEcheancesRetard: echeancesDepassees.length,
        joursRetard,
        echeancePlusAncienne: plusAncienne,
      };
    });

    return NextResponse.json({
      data: result,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        jours,
      },
      stats: {
        total:    stats._count.id,
        montant:  Number(stats._sum.montantRestant ?? 0),
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Erreur alertes impayés' }, { status: 500 });
  }
}
