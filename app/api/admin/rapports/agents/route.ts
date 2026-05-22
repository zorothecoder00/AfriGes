import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/authAdmin';

/**
 * GET /api/admin/rapports/agents
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

    const agents = await prisma.gestionnaire.findMany({
      where: { role: 'AGENT_TERRAIN' },
      include: { member: { select: { id: true, nom: true, prenom: true, telephone: true } } },
    });

    if (agents.length === 0) return NextResponse.json({ data: [] });

    const userIds = agents.map((a) => a.memberId);

    const [clientsParAgent, souscriptions, collectes] = await Promise.all([
      prisma.client.groupBy({
        by:    ['agentTerrainId'],
        where: { agentTerrainId: { in: userIds } },
        _count: { id: true },
      }),

      prisma.souscriptionPack.findMany({
        where: { client: { agentTerrainId: { in: userIds } } },
        select: {
          montantTotal: true, montantVerse: true, montantRestant: true,
          client: { select: { agentTerrainId: true } },
        },
      }),

      prisma.collecteJournaliere.groupBy({
        by:    ['agentId'],
        where: { agentId: { in: userIds }, statut: 'VALIDEE', ...dateFilter },
        _count: { id: true },
        _sum:   { montantCollecte: true },
      }),
    ]);

    const data = agents.map((agent) => {
      const uid        = agent.memberId;
      const nbClients  = clientsParAgent.find((c) => c.agentTerrainId === uid)?._count.id ?? 0;

      const agentSousc = souscriptions.filter((s) => s.client?.agentTerrainId === uid);
      const totalPacks  = agentSousc.reduce((s, c) => s + Number(c.montantTotal),   0);
      const totalVerse  = agentSousc.reduce((s, c) => s + Number(c.montantVerse),   0);
      const totalRestant = agentSousc.reduce((s, c) => s + Number(c.montantRestant), 0);
      const tauxRecouvrement = totalPacks > 0 ? Math.round((totalVerse / totalPacks) * 100) : 0;

      const col = collectes.find((c) => c.agentId === uid);
      const nbCollectes       = col?._count.id ?? 0;
      const montantCollecte   = Number(col?._sum.montantCollecte ?? 0);

      return {
        agentId:  uid,
        nom:      `${agent.member.prenom} ${agent.member.nom}`,
        telephone: agent.member.telephone,
        actif:    agent.actif,
        nbClients,
        nbSouscriptions: agentSousc.length,
        totalPacks,
        totalVerse,
        totalRestant,
        tauxRecouvrement,
        nbCollectes,
        montantCollecte,
        score: tauxRecouvrement * 0.5 + (nbCollectes > 0 ? Math.min(50, nbCollectes * 2) : 0),
      };
    }).sort((a, b) => b.score - a.score);

    return NextResponse.json({ data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Erreur rapport agents' }, { status: 500 });
  }
}
