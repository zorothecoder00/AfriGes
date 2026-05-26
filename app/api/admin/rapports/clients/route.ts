import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/authAdmin';

/**
 * GET /api/admin/rapports/clients
 * ?dateDebut=&dateFin=&agentId=&pdvId=&etat=
 *
 * Liste exhaustive des clients avec leurs indicateurs financiers.
 */
export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const dateDebut = searchParams.get('dateDebut');
    const dateFin   = searchParams.get('dateFin');
    const agentId   = searchParams.get('agentId');
    const pdvId     = searchParams.get('pdvId');
    const etat      = searchParams.get('etat');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};

    if (dateDebut || dateFin) {
      where.createdAt = {
        ...(dateDebut && { gte: new Date(dateDebut) }),
        ...(dateFin   && { lte: new Date(new Date(dateFin).setHours(23, 59, 59, 999)) }),
      };
    }
    if (agentId) where.agentTerrainId = Number(agentId);
    if (pdvId)   where.pointDeVenteId  = Number(pdvId);
    if (etat)    where.etat            = etat;

    const clients = await prisma.client.findMany({
      where,
      select: {
        id:          true,
        codeClient:  true,
        nom:         true,
        prenom:      true,
        telephone:   true,
        ville:       true,
        quartier:    true,
        etat:        true,
        typeClient:  true,
        niveauRisque: true,
        createdAt:   true,
        agentTerrain: { select: { id: true, nom: true, prenom: true } },
        pointDeVente: { select: { id: true, nom: true, code: true } },
        souscriptionsPacks: {
          select: { montantTotal: true, montantVerse: true, montantRestant: true, statut: true },
        },
        creditsClients: {
          select: { montantTotal: true, montantRembourse: true, soldeRestant: true, statut: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = clients.map((c) => {
      const souscActives = c.souscriptionsPacks.filter(
        (s) => s.statut === 'ACTIF' || s.statut === 'EN_ATTENTE',
      );
      const creditsActifs = c.creditsClients.filter(
        (cr) => cr.statut === 'ACTIF' || cr.statut === 'EN_RETARD',
      );

      const totalSouscriptions  = c.souscriptionsPacks.length;
      const totalCredits         = c.creditsClients.length;
      const montantRestantSousc  = souscActives.reduce((s, x) => s + Number(x.montantRestant), 0);
      const soldeRestantCredits  = creditsActifs.reduce((s, x) => s + Number(x.soldeRestant), 0);
      const totalVerse           = c.souscriptionsPacks.reduce((s, x) => s + Number(x.montantVerse), 0)
                                 + c.creditsClients.reduce((s, x) => s + Number(x.montantRembourse), 0);
      const totalEngagement      = c.souscriptionsPacks.reduce((s, x) => s + Number(x.montantTotal), 0)
                                 + c.creditsClients.reduce((s, x) => s + Number(x.montantTotal), 0);

      return {
        id:              c.id,
        codeClient:      c.codeClient ?? '—',
        nom:             c.nom,
        prenom:          c.prenom,
        telephone:       c.telephone,
        ville:           c.ville ?? '',
        quartier:        c.quartier ?? '',
        etat:            c.etat,
        typeClient:      c.typeClient ?? '—',
        niveauRisque:    c.niveauRisque ?? 'FAIBLE',
        agent:           c.agentTerrain
          ? `${c.agentTerrain.prenom} ${c.agentTerrain.nom}` : '—',
        pdv:             c.pointDeVente
          ? `${c.pointDeVente.nom} (${c.pointDeVente.code})` : '—',
        totalSouscriptions,
        totalCredits,
        totalEngagement,
        totalVerse,
        montantRestant:  montantRestantSousc + soldeRestantCredits,
        createdAt:       c.createdAt.toISOString().slice(0, 10),
      };
    });

    // Totaux agrégés
    const totaux = {
      nbClients:       data.length,
      totalEngagement: data.reduce((s, d) => s + d.totalEngagement, 0),
      totalVerse:      data.reduce((s, d) => s + d.totalVerse, 0),
      montantRestant:  data.reduce((s, d) => s + d.montantRestant, 0),
      nbActifs:        data.filter((d) => d.etat === 'ACTIF').length,
    };

    return NextResponse.json({ data, totaux });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Erreur rapport clients' }, { status: 500 });
  }
}
