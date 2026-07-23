import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAgentTerrainSession } from '@/lib/authAgentTerrain';
import { autoCloseOldSessions } from '@/lib/collecteAutoClose';
import { calculerResumeSessionJour } from '@/lib/popc/realisationsServer';
import { trouverOuCreerSessionDuJour } from '@/lib/collecteSession';

const STATUTS_SOUSCRIPTION = ['ACTIF', 'EN_ATTENTE'] as const;
const STATUTS_CREDIT        = ['ACTIF', 'EN_RETARD']  as const;

function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function tomorrow() {
  const d = today();
  d.setDate(d.getDate() + 1);
  return d;
}

/**
 * GET /api/agentTerrain/collecteJour
 * Retourne la session du jour (ou null) + liste clients + stats journalières.
 */
export async function GET(_req: Request) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const agentId = parseInt(session.user.id);
    const debut   = today();
    const fin     = tomorrow();

    // 0. Clôture automatique des sessions des jours précédents
    await autoCloseOldSessions(agentId);

    // 1. Session du jour
    const sessionJour = await prisma.collecteJournaliere.findFirst({
      where: { agentId, dateCollecte: { gte: debut, lt: fin }, statut: { not: 'ANNULEE' } },
      select: {
        id: true, reference: true, statut: true,
        montantPrevu: true, montantCollecte: true,
        dateCollecte: true,
        lignes: {
          select: {
            id: true, type: true, statut: true, montantAttendu: true, montantCollecte: true,
            client: { select: { id: true, nom: true, prenom: true } },
          },
        },
      },
    });

    // 2. Clients de l'agent avec leurs dettes
    const clients = await prisma.client.findMany({
      where: { agentTerrainId: agentId },
      select: {
        id: true, nom: true, prenom: true, telephone: true,
        adresse: true, latitude: true, longitude: true, etat: true,
        souscriptionsPacks: {
          where: {
            statut: { in: [...STATUTS_SOUSCRIPTION] },
            montantRestant: { gt: 0 },
          },
          select: {
            id: true, montantTotal: true, montantVerse: true, montantRestant: true, statut: true,
            pack: { select: { nom: true, type: true, frequenceVersement: true } },
            echeances: {
              where: { statut: { in: ['EN_ATTENTE', 'EN_RETARD'] } },
              select: { id: true, montant: true, datePrevue: true, statut: true },
              orderBy: { numero: 'asc' },
              take: 1,
            },
          },
        },
        creditsClients: {
          where: { statut: { in: [...STATUTS_CREDIT] }, soldeRestant: { gt: 0 } },
          select: {
            id: true, reference: true, montantTotal: true,
            montantRembourse: true, soldeRestant: true,
            montantJournalier: true, dateEcheanceFin: true,
            echeances: {
              where: { statut: { in: ['EN_ATTENTE', 'EN_RETARD'] } },
              select: { id: true, montantDu: true, dateEcheance: true, statut: true },
              orderBy: { dateEcheance: 'asc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { nom: 'asc' },
    });

    // 3. Stats journalières
    const [versJour, rembJour] = await Promise.all([
      prisma.versementPack.aggregate({
        _sum: { montant: true },
        where: { encaisseParId: agentId, datePaiement: { gte: debut, lt: fin }, statut: 'PAYE' },
      }),
      prisma.remboursementCredit.aggregate({
        _sum: { montant: true },
        where: { enregistreParId: agentId, dateRemboursement: { gte: debut, lt: fin } },
      }),
    ]);

    const totalCollecteJour = Number(versJour._sum.montant ?? 0) +
                              Number(rembJour._sum.montant ?? 0);

    // 4. Calculs agrégés
    const totalACollecter = clients.reduce((sum, c) => {
      const packs   = c.souscriptionsPacks.reduce((s, p) => s + Number(p.montantRestant), 0);
      const credits = c.creditsClients.reduce((s, cr) => s + Number(cr.soldeRestant), 0);
      return sum + packs + credits;
    }, 0);

    const retardsCritiques = clients.reduce((count, c) => {
      const rp = c.souscriptionsPacks.filter(s => s.echeances.some(e => e.statut === 'EN_RETARD')).length;
      const rc = c.creditsClients.filter(cr => cr.echeances.some(e => e.statut === 'EN_RETARD')).length;
      return count + rp + rc;
    }, 0);

    const resume = sessionJour ? await calculerResumeSessionJour(sessionJour.id) : null;

    return NextResponse.json({
      session: sessionJour,
      resume,
      clients,
      stats: {
        totalClients:      clients.length,
        totalACollecter,
        totalCollecteJour,
        retardsCritiques,
      },
    });
  } catch (error) {
    console.error('GET /api/agentTerrain/collecteJour', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * POST /api/agentTerrain/collecteJour
 * Crée (ou retourne) la session de collecte du jour.
 */
export async function POST(_req: Request) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const agentId = parseInt(session.user.id);
    const nouvelleSession = await trouverOuCreerSessionDuJour(agentId);

    return NextResponse.json({ data: nouvelleSession }, { status: 201 });
  } catch (error) {
    console.error('POST /api/agentTerrain/collecteJour', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
