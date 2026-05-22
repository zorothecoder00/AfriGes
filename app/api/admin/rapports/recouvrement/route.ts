import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/authAdmin';

/**
 * GET /api/admin/rapports/recouvrement
 * ?dateDebut=&dateFin=
 */
export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const dateDebut = searchParams.get('dateDebut');
    const dateFin   = searchParams.get('dateFin');

    const createdAtFilter = (dateDebut || dateFin) ? {
      createdAt: {
        ...(dateDebut && { gte: new Date(dateDebut) }),
        ...(dateFin   && { lte: new Date(new Date(dateFin).setHours(23, 59, 59, 999)) }),
      },
    } : {};

    const [globalAgg, parTypePack, souscriptionsAvecAgent, souscriptionsAvecPdv, versementsParMois] = await Promise.all([
      // Stats globales
      prisma.souscriptionPack.aggregate({
        where: createdAtFilter,
        _sum:   { montantTotal: true, montantVerse: true, montantRestant: true },
        _count: { id: true },
      }),

      // Par type de pack
      prisma.souscriptionPack.findMany({
        where: createdAtFilter,
        select: {
          montantTotal: true, montantVerse: true, montantRestant: true,
          pack: { select: { type: true } },
        },
      }),

      // Pour calcul par agent (via client.agentTerrain)
      prisma.souscriptionPack.findMany({
        where: { ...createdAtFilter, client: { agentTerrainId: { not: null } } },
        select: {
          montantTotal: true, montantVerse: true, montantRestant: true,
          client: {
            select: {
              agentTerrainId: true,
              agentTerrain: { select: { id: true, nom: true, prenom: true } },
            },
          },
        },
      }),

      // Pour calcul par PDV
      prisma.souscriptionPack.findMany({
        where: { ...createdAtFilter, client: { pointDeVenteId: { not: null } } },
        select: {
          montantTotal: true, montantVerse: true, montantRestant: true,
          client: {
            select: {
              pointDeVente: { select: { id: true, nom: true, code: true } },
            },
          },
        },
      }),

      // Évolution mensuelle (versements)
      prisma.versementPack.findMany({
        where: {
          ...(dateDebut || dateFin ? {
            createdAt: {
              ...(dateDebut && { gte: new Date(dateDebut) }),
              ...(dateFin   && { lte: new Date(new Date(dateFin).setHours(23, 59, 59, 999)) }),
            },
          } : {}),
        },
        select: { montant: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Taux global
    const totalPacks  = Number(globalAgg._sum.montantTotal  ?? 0);
    const totalVerse  = Number(globalAgg._sum.montantVerse  ?? 0);
    const totalRestant = Number(globalAgg._sum.montantRestant ?? 0);
    const tauxGlobal  = totalPacks > 0 ? Math.round((totalVerse / totalPacks) * 100) : 0;

    // Par type de pack
    const typeMap: Record<string, { type: string; nb: number; total: number; verse: number; restant: number }> = {};
    for (const s of parTypePack) {
      const t = s.pack.type;
      if (!typeMap[t]) typeMap[t] = { type: t, nb: 0, total: 0, verse: 0, restant: 0 };
      typeMap[t].nb      += 1;
      typeMap[t].total   += Number(s.montantTotal);
      typeMap[t].verse   += Number(s.montantVerse);
      typeMap[t].restant += Number(s.montantRestant);
    }
    const parTypePacked = Object.values(typeMap).map((t) => ({
      ...t,
      taux: t.total > 0 ? Math.round((t.verse / t.total) * 100) : 0,
    })).sort((a, b) => b.total - a.total);

    // Par agent
    const agentMap: Record<number, { agentId: number; nom: string; nb: number; total: number; verse: number; restant: number }> = {};
    for (const s of souscriptionsAvecAgent) {
      if (!s.client?.agentTerrainId || !s.client?.agentTerrain) continue;
      const aid = s.client.agentTerrainId;
      const ag  = s.client.agentTerrain;
      if (!agentMap[aid]) agentMap[aid] = { agentId: aid, nom: `${ag.prenom} ${ag.nom}`, nb: 0, total: 0, verse: 0, restant: 0 };
      agentMap[aid].nb      += 1;
      agentMap[aid].total   += Number(s.montantTotal);
      agentMap[aid].verse   += Number(s.montantVerse);
      agentMap[aid].restant += Number(s.montantRestant);
    }
    const parAgent = Object.values(agentMap).map((a) => ({
      ...a,
      taux: a.total > 0 ? Math.round((a.verse / a.total) * 100) : 0,
    })).sort((a, b) => b.taux - a.taux);

    // Par PDV
    const pdvMap: Record<number, { pdvId: number; nom: string; code: string; nb: number; total: number; verse: number; restant: number }> = {};
    for (const s of souscriptionsAvecPdv) {
      const pdv = s.client?.pointDeVente;
      if (!pdv) continue;
      if (!pdvMap[pdv.id]) pdvMap[pdv.id] = { pdvId: pdv.id, nom: pdv.nom, code: pdv.code, nb: 0, total: 0, verse: 0, restant: 0 };
      pdvMap[pdv.id].nb      += 1;
      pdvMap[pdv.id].total   += Number(s.montantTotal);
      pdvMap[pdv.id].verse   += Number(s.montantVerse);
      pdvMap[pdv.id].restant += Number(s.montantRestant);
    }
    const parPdv = Object.values(pdvMap).map((p) => ({
      ...p,
      taux: p.total > 0 ? Math.round((p.verse / p.total) * 100) : 0,
    })).sort((a, b) => b.total - a.total);

    // Évolution mensuelle
    const MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
    const moisMap: Record<string, { label: string; montant: number; nb: number }> = {};
    for (const v of versementsParMois) {
      const d   = new Date(v.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!moisMap[key]) moisMap[key] = { label: `${MOIS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, montant: 0, nb: 0 };
      moisMap[key].montant += Number(v.montant);
      moisMap[key].nb      += 1;
    }
    const evolution = Object.entries(moisMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);

    return NextResponse.json({
      global: { nb: globalAgg._count.id, totalPacks, totalVerse, totalRestant, tauxGlobal },
      parTypePack: parTypePacked,
      parAgent,
      parPdv,
      evolution,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Erreur rapport recouvrement' }, { status: 500 });
  }
}
