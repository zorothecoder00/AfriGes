import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/authAdmin';

/**
 * GET /api/admin/agents-terrain
 * Supervision des agents de recouvrement avec stats complètes
 */
export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get('search') || '').trim();
    const actifParam = searchParams.get('actif');
    const actif = actifParam === 'false' ? false : actifParam === 'true' ? true : undefined;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Tous les agents de terrain
    const agentsDb = await prisma.gestionnaire.findMany({
      where: {
        role: 'AGENT_TERRAIN',
        ...(actif !== undefined && { actif }),
        ...(search && {
          OR: [
            { member: { nom:    { contains: search, mode: 'insensitive' } } },
            { member: { prenom: { contains: search, mode: 'insensitive' } } },
          ],
        }),
      },
      include: {
        member: {
          select: {
            id: true, nom: true, prenom: true,
            email: true, telephone: true, etat: true,
            affectationsPDV: {
              where: { actif: true },
              select: { pointDeVente: { select: { id: true, nom: true, code: true } } },
              take: 1,
            },
          },
        },
      },
      orderBy: { member: { nom: 'asc' } },
    });

    if (agentsDb.length === 0) {
      return NextResponse.json({ data: [], stats: { total: 0, actifs: 0 } });
    }

    const userIds = agentsDb.map((a) => a.memberId);

    // 2. Stats en parallèle
    const [
      clientsParAgent,
      creancesOuvertes,
      toutesCreances,
      // Sessions de collecte terrain validées ce mois (pour nbCollectesCeMois + montant CollecteJournaliere)
      // Note : les VersementPack générés lors de la validation ont encaisseParId = admin (pas l'agent),
      // donc CollecteJournaliere et VersementPack ne se chevauchent PAS.
      collectesSessionsMois,
      derniereActivite,
      // Versements packs encaissés directement par l'agent (hors collectes terrain)
      versementsParAgentMois,
      // Remboursements crédits enregistrés par l'agent
      remboursementsParAgentMois,
      // Ventes directes réalisées par l'agent
      ventesParAgentMois,
    ] = await Promise.all([
      // Nb clients affectés
      prisma.client.groupBy({
        by: ['agentTerrainId'],
        where: { agentTerrainId: { in: userIds } },
        _count: { id: true },
      }),

      // Créances ouvertes (montantRestant > 0) — pour nb + montant
      prisma.souscriptionPack.findMany({
        where: { montantRestant: { gt: 0 }, client: { agentTerrainId: { in: userIds } } },
        select: { montantRestant: true, client: { select: { agentTerrainId: true } } },
      }),

      // Toutes souscriptions — pour taux recouvrement
      prisma.souscriptionPack.findMany({
        where: { client: { agentTerrainId: { in: userIds } } },
        select: { montantTotal: true, montantVerse: true, client: { select: { agentTerrainId: true } } },
      }),

      // Sessions de collecte terrain validées ce mois
      prisma.collecteJournaliere.groupBy({
        by: ['agentId'],
        where: { agentId: { in: userIds }, statut: 'VALIDEE', dateCollecte: { gte: startOfMonth } },
        _sum:   { montantCollecte: true },
        _count: { id: true },
      }),

      // Dernière activité terrain (collecte la plus récente, tous statuts)
      prisma.collecteJournaliere.groupBy({
        by: ['agentId'],
        where: { agentId: { in: userIds } },
        _max: { dateCollecte: true },
      }),

      // Versements packs encaissés directement par l'agent ce mois (encaisseParId = agent)
      prisma.versementPack.groupBy({
        by: ['encaisseParId'],
        where: {
          encaisseParId: { in: userIds },
          datePaiement:  { gte: startOfMonth },
          statut:        'PAYE',
        },
        _sum: { montant: true },
      }),

      // Remboursements crédits enregistrés par l'agent ce mois
      prisma.remboursementCredit.groupBy({
        by: ['enregistreParId'],
        where: {
          enregistreParId: { in: userIds },
          dateRemboursement: { gte: startOfMonth },
        },
        _sum: { montant: true },
      }),

      // Ventes directes réalisées par l'agent ce mois
      prisma.venteDirecte.groupBy({
        by: ['vendeurId'],
        where: {
          vendeurId: { in: userIds },
          createdAt: { gte: startOfMonth },
          statut:    { notIn: ['ANNULEE', 'BROUILLON'] },
        },
        _sum: { montantTotal: true },
      }),
    ]);

    // 3. Calcul des stats par agent
    const data = agentsDb.map((agent) => {
      const uid = agent.memberId;

      const nbClients   = clientsParAgent.find((c) => c.agentTerrainId === uid)?._count.id ?? 0;

      const agentCreancesOuvertes = creancesOuvertes.filter((c) => c.client?.agentTerrainId === uid);
      const nbCreancesActives     = agentCreancesOuvertes.length;
      const montantCreances       = agentCreancesOuvertes.reduce((s, c) => s + Number(c.montantRestant), 0);

      const agentToutesCreances   = toutesCreances.filter((c) => c.client?.agentTerrainId === uid);
      const totalPacks            = agentToutesCreances.reduce((s, c) => s + Number(c.montantTotal), 0);
      const totalVerse            = agentToutesCreances.reduce((s, c) => s + Number(c.montantVerse), 0);
      const tauxRecouvrement      = totalPacks > 0 ? Math.round((totalVerse / totalPacks) * 100) : 0;

      const collecteSession        = collectesSessionsMois.find((c) => c.agentId === uid);
      const nbCollectesCeMois      = collecteSession?._count.id ?? 0;

      // Montant total encaissé ce mois = 4 sources combinées (sans double comptage)
      const montantCollecteTerrain = Number(collecteSession?._sum.montantCollecte ?? 0);
      const montantVersementsDirec = Number(versementsParAgentMois.find((v) => v.encaisseParId === uid)?._sum.montant ?? 0);
      const montantRembCredit      = Number(remboursementsParAgentMois.find((r) => r.enregistreParId === uid)?._sum.montant ?? 0);
      const montantVentes          = Number(ventesParAgentMois.find((v) => v.vendeurId === uid)?._sum.montantTotal ?? 0);
      const montantCollecteCeMois  = montantCollecteTerrain + montantVersementsDirec + montantRembCredit + montantVentes;

      const derniereActiviteDate  = derniereActivite.find((d) => d.agentId === uid)?._max.dateCollecte ?? null;

      return {
        id:        agent.id,
        memberId:  uid,
        actif:     agent.actif,
        zone:      agent.zone ?? null,
        member:    agent.member,
        stats: {
          nbClients,
          nbCreancesActives,
          montantCreances,
          montantCollecteCeMois,
          nbCollectesCeMois,
          tauxRecouvrement,
          totalVerse,
          totalPacks,
          derniereActivite: derniereActiviteDate,
          // Détail des 4 sources de collecte ce mois
          collecteDetail: {
            terrain:      montantCollecteTerrain,
            versements:   montantVersementsDirec,
            remboursements: montantRembCredit,
            ventes:       montantVentes,
          },
        },
      };
    });

    return NextResponse.json({
      data,
      stats: {
        total:  agentsDb.length,
        actifs: agentsDb.filter((a) => a.actif).length,
        totalClientsAffectes: clientsParAgent.reduce((s, c) => s + c._count.id, 0),
        totalCollecteCeMois: (
          collectesSessionsMois.reduce((s, c) => s + Number(c._sum.montantCollecte ?? 0), 0) +
          versementsParAgentMois.reduce((s, v) => s + Number(v._sum.montant ?? 0), 0) +
          remboursementsParAgentMois.reduce((s, r) => s + Number(r._sum.montant ?? 0), 0) +
          ventesParAgentMois.reduce((s, v) => s + Number(v._sum.montantTotal ?? 0), 0)
        ),
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Erreur supervision agents' }, { status: 500 });
  }
}
