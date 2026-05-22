import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/authAdmin';

/**
 * GET /api/admin/rapports/creances
 * Snapshot actuel des créances (pas de filtre date — état du portefeuille)
 */
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });

    const now = new Date();

    // Toutes les créances ouvertes avec leurs plus anciennes échéances en retard
    const creances = await prisma.souscriptionPack.findMany({
      where: { montantRestant: { gt: 0 } },
      select: {
        id: true,
        montantTotal:   true,
        montantVerse:   true,
        montantRestant: true,
        statut:         true,
        client: {
          select: {
            agentTerrain: { select: { id: true, nom: true, prenom: true } },
            pointDeVente: { select: { id: true, nom: true, code: true } },
          },
        },
        echeances: {
          where:   { statut: 'EN_ATTENTE' },
          orderBy: { datePrevue: 'asc' },
          take:    1,
          select:  { datePrevue: true },
        },
      },
    });

    // Répartition par ancienneté du retard
    const tranches = { j0_30: 0, j31_60: 0, j61_90: 0, j90plus: 0, sansRetard: 0 };
    const montants = { j0_30: 0, j31_60: 0, j61_90: 0, j90plus: 0, sansRetard: 0 };

    // Par agent
    const agentMap: Record<number, { agentId: number; nom: string; nb: number; montant: number }> = {};
    // Par PDV
    const pdvMap:   Record<number, { pdvId: number; nom: string; code: string; nb: number; montant: number }> = {};

    for (const c of creances) {
      const restant = Number(c.montantRestant);
      const ech     = c.echeances[0];
      let jours = 0;

      if (ech && new Date(ech.datePrevue) < now) {
        jours = Math.floor((now.getTime() - new Date(ech.datePrevue).getTime()) / 86400000);
      }

      if (jours === 0)       { tranches.sansRetard++; montants.sansRetard += restant; }
      else if (jours <= 30)  { tranches.j0_30++;      montants.j0_30      += restant; }
      else if (jours <= 60)  { tranches.j31_60++;     montants.j31_60     += restant; }
      else if (jours <= 90)  { tranches.j61_90++;     montants.j61_90     += restant; }
      else                   { tranches.j90plus++;    montants.j90plus    += restant; }

      // Agent
      const ag = c.client?.agentTerrain;
      if (ag) {
        if (!agentMap[ag.id]) agentMap[ag.id] = { agentId: ag.id, nom: `${ag.prenom} ${ag.nom}`, nb: 0, montant: 0 };
        agentMap[ag.id].nb      += 1;
        agentMap[ag.id].montant += restant;
      }

      // PDV
      const pdv = c.client?.pointDeVente;
      if (pdv) {
        if (!pdvMap[pdv.id]) pdvMap[pdv.id] = { pdvId: pdv.id, nom: pdv.nom, code: pdv.code, nb: 0, montant: 0 };
        pdvMap[pdv.id].nb      += 1;
        pdvMap[pdv.id].montant += restant;
      }
    }

    const totalRestant = creances.reduce((s, c) => s + Number(c.montantRestant), 0);
    const totalPacks   = creances.reduce((s, c) => s + Number(c.montantTotal),   0);
    const totalVerse   = creances.reduce((s, c) => s + Number(c.montantVerse),   0);

    return NextResponse.json({
      global: {
        nbCreances:   creances.length,
        totalRestant,
        totalPacks,
        totalVerse,
        tauxRecouvrement: totalPacks > 0 ? Math.round((totalVerse / totalPacks) * 100) : 0,
      },
      parAnciennete: [
        { label: 'Sans retard',   nb: tranches.sansRetard, montant: montants.sansRetard, color: 'emerald' },
        { label: '1 – 30 jours',  nb: tranches.j0_30,      montant: montants.j0_30,      color: 'amber' },
        { label: '31 – 60 jours', nb: tranches.j31_60,     montant: montants.j31_60,     color: 'orange' },
        { label: '61 – 90 jours', nb: tranches.j61_90,     montant: montants.j61_90,     color: 'red' },
        { label: '> 90 jours',    nb: tranches.j90plus,    montant: montants.j90plus,    color: 'rose' },
      ],
      parAgent: Object.values(agentMap).sort((a, b) => b.montant - a.montant),
      parPdv:   Object.values(pdvMap).sort((a, b) => b.montant - a.montant),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Erreur rapport créances' }, { status: 500 });
  }
}
