import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/authAdmin';

/**
 * GET /api/admin/rapports/collectes
 * ?dateDebut=&dateFin=
 */
export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const dateDebut = searchParams.get('dateDebut');
    const dateFin   = searchParams.get('dateFin');

    const dateFilter = (dateDebut || dateFin) ? {
      dateCollecte: {
        ...(dateDebut && { gte: new Date(dateDebut) }),
        ...(dateFin   && { lte: new Date(new Date(dateFin).setHours(23, 59, 59, 999)) }),
      },
    } : {};

    const [globalStats, parStatut, collectesParAgent, collectesParJour] = await Promise.all([
      prisma.collecteJournaliere.aggregate({
        where: dateFilter,
        _count: { id: true },
        _sum:   { montantCollecte: true, montantPrevu: true },
      }),

      prisma.collecteJournaliere.groupBy({
        by:    ['statut'],
        where: dateFilter,
        _count: { id: true },
        _sum:   { montantCollecte: true },
      }),

      prisma.collecteJournaliere.groupBy({
        by:      ['agentId'],
        where:   { ...dateFilter, statut: 'VALIDEE' },
        _count:  { id: true },
        _sum:    { montantCollecte: true },
        orderBy: { _sum: { montantCollecte: 'desc' } },
      }),

      prisma.collecteJournaliere.findMany({
        where:   { ...dateFilter, statut: 'VALIDEE' },
        select:  { dateCollecte: true, montantCollecte: true },
        orderBy: { dateCollecte: 'asc' },
      }),
    ]);

    // Infos agents
    const agentIds  = collectesParAgent.map((c) => c.agentId);
    const agentUsers = agentIds.length
      ? await prisma.user.findMany({ where: { id: { in: agentIds } }, select: { id: true, nom: true, prenom: true } })
      : [];

    const parAgent = collectesParAgent.map((c) => {
      const u = agentUsers.find((a) => a.id === c.agentId);
      return {
        agentId:  c.agentId,
        nom:      u ? `${u.prenom} ${u.nom}` : '—',
        nbCollectes:    c._count.id,
        montantCollecte: Number(c._sum.montantCollecte ?? 0),
      };
    });

    // Évolution par jour
    const jourMap: Record<string, { date: string; montant: number; nb: number }> = {};
    for (const c of collectesParJour) {
      const d   = new Date(c.dateCollecte);
      const key = d.toISOString().slice(0, 10);
      if (!jourMap[key]) jourMap[key] = { date: key, montant: 0, nb: 0 };
      jourMap[key].montant += Number(c.montantCollecte);
      jourMap[key].nb      += 1;
    }
    const parJour = Object.values(jourMap);

    const totalPrevu    = Number(globalStats._sum.montantPrevu    ?? 0);
    const totalCollecte = Number(globalStats._sum.montantCollecte ?? 0);

    return NextResponse.json({
      global: {
        nbTotal:        globalStats._count.id,
        totalPrevu,
        totalCollecte,
        tauxRealisation: totalPrevu > 0 ? Math.round((totalCollecte / totalPrevu) * 100) : 0,
      },
      parStatut: parStatut.map((s) => ({
        statut:  s.statut,
        nb:      s._count.id,
        montant: Number(s._sum.montantCollecte ?? 0),
      })),
      parAgent,
      parJour,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Erreur rapport collectes' }, { status: 500 });
  }
}
