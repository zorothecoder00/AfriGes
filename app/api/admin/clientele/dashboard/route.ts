import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/authAdmin';

/**
 * GET /api/admin/clientele/dashboard
 * Tableau de bord de décision — module Gestion de la clientèle
 */
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      totalClients,
      clientsActifs,
      clientsBloques,
      creancesAgg,
      allSouscAgg,
      creancesEnRetardCount,
      montantEnRetardAgg,
      collectesJour,
      collectesMois,
      versementsMensuels,
      collectesParAgent,
      clientsParAgent,
      creancesCritiques,
    ] = await Promise.all([
      // ── Clients ───────────────────────────────────────────────────────────────
      prisma.client.count(),
      prisma.client.count({ where: { etat: 'ACTIF' } }),
      prisma.client.count({ where: { etat: 'BLOQUE' } }),

      // ── Créances ouvertes ─────────────────────────────────────────────────────
      prisma.souscriptionPack.aggregate({
        where: { montantRestant: { gt: 0 } },
        _count: { id: true },
        _sum:  { montantRestant: true },
      }),

      // Toutes souscriptions — pour le taux de recouvrement global
      prisma.souscriptionPack.aggregate({
        _sum: { montantTotal: true, montantVerse: true },
      }),

      // Créances avec au moins une échéance EN_ATTENTE dépassée
      prisma.souscriptionPack.count({
        where: {
          montantRestant: { gt: 0 },
          echeances: { some: { datePrevue: { lt: now }, statut: 'EN_ATTENTE' } },
        },
      }),

      prisma.souscriptionPack.aggregate({
        where: {
          montantRestant: { gt: 0 },
          echeances: { some: { datePrevue: { lt: now }, statut: 'EN_ATTENTE' } },
        },
        _sum: { montantRestant: true },
      }),

      // ── Collectes ─────────────────────────────────────────────────────────────
      prisma.collecteJournaliere.aggregate({
        where: { dateCollecte: { gte: startOfToday }, statut: 'VALIDEE' },
        _count: { id: true },
        _sum:   { montantCollecte: true },
      }),

      prisma.collecteJournaliere.aggregate({
        where: { dateCollecte: { gte: startOfMonth }, statut: 'VALIDEE' },
        _count: { id: true },
        _sum:   { montantCollecte: true },
      }),

      // ── Évolution mensuelle (6 mois) ─────────────────────────────────────────
      prisma.versementPack.findMany({
        where:  { createdAt: { gte: sixMonthsAgo } },
        select: { montant: true, createdAt: true },
      }),

      // ── Top agents par montant collecté ───────────────────────────────────────
      prisma.collecteJournaliere.groupBy({
        by:      ['agentId'],
        where:   { statut: 'VALIDEE' },
        _sum:    { montantCollecte: true },
        _count:  { id: true },
        orderBy: { _sum: { montantCollecte: 'desc' } },
        take:    5,
      }),

      // Nb clients par agent
      prisma.client.groupBy({
        by:    ['agentTerrainId'],
        where: { agentTerrainId: { not: null } },
        _count: { id: true },
      }),

      // ── Créances critiques (les + importantes en retard) ─────────────────────
      prisma.souscriptionPack.findMany({
        where: {
          montantRestant: { gt: 0 },
          echeances: { some: { datePrevue: { lt: now }, statut: 'EN_ATTENTE' } },
        },
        select: {
          id: true,
          montantRestant: true,
          montantTotal:   true,
          client: { select: { id: true, nom: true, prenom: true, telephone: true, codeClient: true } },
          pack:   { select: { nom: true, type: true } },
          echeances: {
            where:   { datePrevue: { lt: now }, statut: 'EN_ATTENTE' },
            orderBy: { datePrevue: 'asc' },
            take:    1,
            select:  { datePrevue: true, montant: true },
          },
        },
        orderBy: { montantRestant: 'desc' },
        take: 6,
      }),
    ]);

    // Fetch noms des agents
    const agentIds = collectesParAgent.map((c) => c.agentId);
    const agentUsers = agentIds.length
      ? await prisma.user.findMany({
          where:  { id: { in: agentIds } },
          select: { id: true, nom: true, prenom: true },
        })
      : [];

    const topAgents = collectesParAgent.map((c) => {
      const user      = agentUsers.find((u) => u.id === c.agentId);
      const nbClients = clientsParAgent.find((cp) => cp.agentTerrainId === c.agentId)?._count.id ?? 0;
      return {
        agentId:        c.agentId,
        nom:            user?.nom    ?? '—',
        prenom:         user?.prenom ?? '—',
        nbClients,
        nbCollectes:    c._count.id,
        montantCollecte: Number(c._sum.montantCollecte ?? 0),
      };
    });

    // Évolution mensuelle — regroupement JS par mois
    const MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
    const evolutionMap: Record<string, { label: string; montant: number; nombre: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      evolutionMap[key] = { label: `${MOIS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, montant: 0, nombre: 0 };
    }
    for (const v of versementsMensuels) {
      const d   = new Date(v.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (evolutionMap[key]) {
        evolutionMap[key].montant += Number(v.montant);
        evolutionMap[key].nombre  += 1;
      }
    }
    const evolutionMensuelle = Object.values(evolutionMap);

    // Taux de recouvrement global
    const montantTotal = Number(allSouscAgg._sum.montantTotal ?? 0);
    const montantVerse = Number(allSouscAgg._sum.montantVerse ?? 0);
    const tauxRecouvrement = montantTotal > 0 ? Math.round((montantVerse / montantTotal) * 100) : 0;

    return NextResponse.json({
      kpis: {
        totalClients,
        clientsActifs,
        clientsBloques,
        totalCreances:    creancesAgg._count.id,
        montantTotalDu:   Number(creancesAgg._sum.montantRestant ?? 0),
        montantTotal,
        montantVerse,
        tauxRecouvrement,
        creancesEnRetard: creancesEnRetardCount,
        montantEnRetard:  Number(montantEnRetardAgg._sum.montantRestant ?? 0),
        collectesJour: {
          nombre:  collectesJour._count.id,
          montant: Number(collectesJour._sum.montantCollecte ?? 0),
        },
        collectesMois: {
          nombre:  collectesMois._count.id,
          montant: Number(collectesMois._sum.montantCollecte ?? 0),
        },
      },
      evolutionMensuelle,
      topAgents,
      creancesCritiques: creancesCritiques.map((c) => ({
        id:             c.id,
        montantRestant: Number(c.montantRestant),
        montantTotal:   Number(c.montantTotal),
        client:         c.client,
        pack:           c.pack,
        echeanceRetard: c.echeances[0] ?? null,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Erreur tableau de bord clientèle' }, { status: 500 });
  }
}
