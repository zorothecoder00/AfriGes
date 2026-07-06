import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/authAdmin';

/**
 * GET /api/admin/rapports/agents
 * ?dateDebut=&dateFin=
 *
 * Classement des agents terrain par CA réel (même méthode que le dashboard décisionnel) :
 *   CA = versementPack + remboursementCredit + venteDirecte (sur la période)
 */
export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const dateDebut = searchParams.get('dateDebut');
    const dateFin   = searchParams.get('dateFin');

    const fin = dateFin ? new Date(new Date(dateFin).setHours(23, 59, 59, 999)) : undefined;
    const deb = dateDebut ? new Date(dateDebut) : undefined;

    // Filtre générique par plage de dates (le champ varie selon le modèle)
    function dateRange(field: string) {
      if (!deb && !fin) return {};
      return {
        [field]: {
          ...(deb && { gte: deb }),
          ...(fin && { lte: fin }),
        },
      };
    }

    const agents = await prisma.gestionnaire.findMany({
      where: { role: 'AGENT_TERRAIN' },
      include: { member: { select: { id: true, nom: true, prenom: true, telephone: true } } },
    });

    if (agents.length === 0) return NextResponse.json({ data: [] });

    const userIds = agents.map((a) => a.memberId);

    const [
      clientsParAgent,
      souscriptions,
      collectesSessions,
      versements,
      remboursements,
      ventes,
    ] = await Promise.all([
      // Nb clients affectés à chaque agent (filtré sur la période si fournie —
      // cohérent avec les autres colonnes : tout reflète la même plage de dates)
      prisma.client.groupBy({
        by:    ['agentTerrainId'],
        where: { agentTerrainId: { in: userIds }, ...dateRange('createdAt') },
        _count: { id: true },
      }),

      // Souscriptions rattachées aux clients de l'agent (taux recouvrement),
      // sur la période si fournie
      prisma.souscriptionPack.findMany({
        where: { client: { agentTerrainId: { in: userIds } }, ...dateRange('createdAt') },
        select: {
          montantTotal:   true,
          montantVerse:   true,
          montantRestant: true,
          client: { select: { agentTerrainId: true } },
        },
      }),

      // Sessions de collecte journalière validées
      prisma.collecteJournaliere.groupBy({
        by:    ['agentId'],
        where: { agentId: { in: userIds }, statut: 'VALIDEE', ...dateRange('dateCollecte') },
        _count: { id: true },
        _sum:   { montantCollecte: true },
      }),

      // CA source 1 : versements packs encaissés par l'agent
      prisma.versementPack.groupBy({
        by:    ['encaisseParId'],
        where: {
          encaisseParId: { in: userIds },
          statut:        'PAYE',
          ...dateRange('datePaiement'),
        },
        _sum: { montant: true },
      }),

      // CA source 2 : remboursements crédits enregistrés par l'agent
      prisma.remboursementCredit.groupBy({
        by:    ['enregistreParId'],
        where: {
          enregistreParId: { in: userIds },
          ...dateRange('dateRemboursement'),
        },
        _sum: { montant: true },
      }),

      // CA source 3 : ventes directes réalisées par l'agent
      prisma.venteDirecte.groupBy({
        by:    ['vendeurId'],
        where: {
          vendeurId: { in: userIds },
          statut:    { notIn: ['ANNULEE', 'BROUILLON'] },
          ...dateRange('createdAt'),
        },
        _sum: { montantTotal: true },
      }),
    ]);

    // ── Construire la map CA par agent ────────────────────────────────────────
    const caMap = new Map<number, number>();
    for (const v of versements) {
      if (v.encaisseParId === null) continue;
      caMap.set(v.encaisseParId, (caMap.get(v.encaisseParId) ?? 0) + Number(v._sum.montant ?? 0));
    }
    for (const r of remboursements) {
      if (r.enregistreParId === null) continue;
      caMap.set(r.enregistreParId, (caMap.get(r.enregistreParId) ?? 0) + Number(r._sum.montant ?? 0));
    }
    for (const vd of ventes) {
      if (vd.vendeurId === null) continue;
      caMap.set(vd.vendeurId, (caMap.get(vd.vendeurId) ?? 0) + Number(vd._sum.montantTotal ?? 0));
    }

    // ── Construire la réponse ─────────────────────────────────────────────────
    const data = agents.map((agent) => {
      const uid = agent.memberId;

      const nbClients  = clientsParAgent.find((c) => c.agentTerrainId === uid)?._count.id ?? 0;

      const agentSousc    = souscriptions.filter((s) => s.client?.agentTerrainId === uid);
      const totalPacks    = agentSousc.reduce((s, c) => s + Number(c.montantTotal),   0);
      const totalVerse    = agentSousc.reduce((s, c) => s + Number(c.montantVerse),   0);
      const totalRestant  = agentSousc.reduce((s, c) => s + Number(c.montantRestant), 0);
      const tauxRecouvrement = totalPacks > 0 ? Math.round((totalVerse / totalPacks) * 100) : 0;

      const col           = collectesSessions.find((c) => c.agentId === uid);
      const nbCollectes   = col?._count.id ?? 0;
      const montantCollecteSession = Number(col?._sum.montantCollecte ?? 0);

      // CA réel = toutes sources financières confondues
      const caTotal = caMap.get(uid) ?? 0;

      return {
        agentId:   uid,
        nom:       `${agent.member.prenom} ${agent.member.nom}`,
        telephone: agent.member.telephone,
        actif:     agent.actif,
        nbClients,
        nbSouscriptions:      agentSousc.length,
        totalPacks,
        totalVerse,
        totalRestant,
        tauxRecouvrement,
        nbCollectes,
        montantCollecteSession,
        caTotal,          // CA réel (même méthode que le dashboard)
      };
    })
    // Classement par CA réel décroissant (comme le dashboard)
    .sort((a, b) => b.caTotal - a.caTotal);

    return NextResponse.json({ data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Erreur rapport agents' }, { status: 500 });
  }
}
