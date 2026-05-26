import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/authAdmin';

/**
 * GET /api/admin/rapports/retards
 * ?agentId=&pdvId=
 *
 * Snapshot des crédits EN_RETARD avec ancienneté et gravité.
 */
export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId');
    const pdvId   = searchParams.get('pdvId');

    const now = new Date();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const creditWhere: Record<string, any> = { statut: 'EN_RETARD' };

    if (agentId) {
      creditWhere.client = { agentTerrainId: Number(agentId) };
    }
    if (pdvId) {
      creditWhere.pointDeVenteId = Number(pdvId);
    }

    const credits = await prisma.creditClient.findMany({
      where: creditWhere,
      select: {
        id:           true,
        reference:    true,
        montantTotal: true,
        montantRembourse: true,
        soldeRestant: true,
        dateDebut:    true,
        dateEcheanceFin: true,
        client: {
          select: {
            nom:      true,
            prenom:   true,
            telephone: true,
            ville:    true,
            quartier: true,
            agentTerrain: { select: { nom: true, prenom: true } },
            pointDeVente: { select: { nom: true, code: true } },
          },
        },
        echeances: {
          where:   { statut: 'EN_RETARD' },
          orderBy: { dateEcheance: 'asc' },
          take:    1,
          select:  { dateEcheance: true, montantDu: true },
        },
      },
      orderBy: { soldeRestant: 'desc' },
    });

    const data = credits.map((cr) => {
      const premiereEcheance = cr.echeances[0];
      const joursRetard = premiereEcheance
        ? Math.max(0, Math.floor((now.getTime() - new Date(premiereEcheance.dateEcheance).getTime()) / 86_400_000))
        : 0;

      const gravite =
        joursRetard > 90 ? 'CRITIQUE' :
        joursRetard > 60 ? 'ÉLEVÉ'   :
        joursRetard > 30 ? 'MOYEN'   : 'FAIBLE';

      const tauxRembourse = Number(cr.montantTotal) > 0
        ? Math.round((Number(cr.montantRembourse) / Number(cr.montantTotal)) * 100)
        : 0;

      return {
        reference:       cr.reference,
        clientNom:       `${cr.client.prenom} ${cr.client.nom}`,
        clientTel:       cr.client.telephone,
        ville:           cr.client.ville ?? '',
        agent:           cr.client.agentTerrain
          ? `${cr.client.agentTerrain.prenom} ${cr.client.agentTerrain.nom}` : '—',
        pdv:             cr.client.pointDeVente
          ? `${cr.client.pointDeVente.nom} (${cr.client.pointDeVente.code})` : '—',
        montantTotal:    Number(cr.montantTotal),
        montantRembourse: Number(cr.montantRembourse),
        soldeRestant:    Number(cr.soldeRestant),
        tauxRembourse,
        premiereEcheanceRetard: premiereEcheance
          ? new Date(premiereEcheance.dateEcheance).toISOString().slice(0, 10)
          : '—',
        joursRetard,
        gravite,
      };
    });

    // Résumé
    const total          = data.length;
    const montantTotal   = data.reduce((s, d) => s + d.soldeRestant, 0);
    const nbCritique     = data.filter((d) => d.gravite === 'CRITIQUE').length;
    const nbEleve        = data.filter((d) => d.gravite === 'ÉLEVÉ').length;
    const nbMoyen        = data.filter((d) => d.gravite === 'MOYEN').length;
    const nbFaible       = data.filter((d) => d.gravite === 'FAIBLE').length;
    const moyenneJours   = total > 0
      ? Math.round(data.reduce((s, d) => s + d.joursRetard, 0) / total)
      : 0;

    return NextResponse.json({
      data,
      total,
      montantTotal,
      nbCritique,
      nbEleve,
      nbMoyen,
      nbFaible,
      moyenneJours,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Erreur rapport retards' }, { status: 500 });
  }
}
