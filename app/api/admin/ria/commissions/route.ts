import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

/**
 * GET  /api/admin/ria/commissions
 * POST /api/admin/ria/commissions
 *
 * GET  — liste les commissions calculées par agent / chef agence pour une période
 *   Query : mois?, annee?, role? (AGENT_TERRAIN | CHEF_AGENCE)
 *
 * POST — { mois, annee, tauxAgent?, tauxChef? } → recalcule et retourne
 *   Calcul basé sur les RemboursementRIA de la période dont le crédit
 *   a été collecté par un agent ou supervisé par un chef agence.
 *
 *   Commission agent = somme(remboursementsRIA de la période) × tauxAgent/100
 *   Commission chef  = somme(remboursementsRIA équipe) × tauxChef/100
 */

const DEFAULT_TAUX_AGENT = 1.0;  // 1% des remboursements collectés
const DEFAULT_TAUX_CHEF  = 0.5;  // 0.5% pour le chef agence

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const mois  = searchParams.get("mois")  ? parseInt(searchParams.get("mois")!)  : new Date().getMonth() + 1;
    const annee = searchParams.get("annee") ? parseInt(searchParams.get("annee")!) : new Date().getFullYear();

    const debut = new Date(annee, mois - 1, 1);
    const fin   = new Date(annee, mois, 1);

    // Récupère les remboursements crédit de la période dont le crédit a un agent terrain
    const remboursementsRIA = await prisma.remboursementRIA.findMany({
      where: { createdAt: { gte: debut, lt: fin } },
      include: {
        financement: {
          include: {
            creditClient: {
              include: {
                client: { select: { id: true, nom: true, prenom: true, agentTerrainId: true } },
              },
            },
          },
        },
      },
    });

    // Agréger par agent terrain
    const parAgent: Record<number, { agentId: number; totalRembourse: number; nbOps: number }> = {};

    for (const rmb of remboursementsRIA) {
      const agentId = rmb.financement.creditClient?.client?.agentTerrainId;
      if (!agentId) continue;
      if (!parAgent[agentId]) parAgent[agentId] = { agentId, totalRembourse: 0, nbOps: 0 };
      parAgent[agentId].totalRembourse += Number(rmb.montant);
      parAgent[agentId].nbOps++;
    }

    // Récupérer les infos des agents
    const agentIds = Object.keys(parAgent).map(Number);
    const agents = agentIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: agentIds } },
          select: { id: true, nom: true, prenom: true },
        })
      : [];

    const commissionsAgents = agents.map((agent) => {
      const stats = parAgent[agent.id];
      const commission = stats.totalRembourse * (DEFAULT_TAUX_AGENT / 100);
      return {
        agentId:       agent.id,
        nom:           `${agent.prenom} ${agent.nom}`,
        role:          "AGENT_TERRAIN",
        totalRembourse: stats.totalRembourse,
        nbOps:          stats.nbOps,
        taux:           DEFAULT_TAUX_AGENT,
        commission,
      };
    });

    const totalCommissions = commissionsAgents.reduce((s, a) => s + a.commission, 0);
    const totalRembourse   = commissionsAgents.reduce((s, a) => s + a.totalRembourse, 0);

    return NextResponse.json({
      mois,
      annee,
      commissions: commissionsAgents,
      totaux: { totalCommissions, totalRembourse, nbAgents: commissionsAgents.length },
    });
  } catch (error) {
    console.error("GET /api/admin/ria/commissions", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ── POST — recalcul avec taux personnalisés ───────────────────────────────────

export async function POST(req: Request) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const {
      mois    = new Date().getMonth() + 1,
      annee   = new Date().getFullYear(),
      tauxAgent = DEFAULT_TAUX_AGENT,
      tauxChef  = DEFAULT_TAUX_CHEF,
    } = body as { mois?: number; annee?: number; tauxAgent?: number; tauxChef?: number };

    const debut = new Date(annee, mois - 1, 1);
    const fin   = new Date(annee, mois, 1);

    const remboursementsRIA = await prisma.remboursementRIA.findMany({
      where: { createdAt: { gte: debut, lt: fin } },
      include: {
        financement: {
          include: {
            creditClient: {
              include: {
                client: {
                  select: {
                    id: true, nom: true, prenom: true,
                    agentTerrainId: true,
                    pointDeVenteId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Agréger par agent
    const parAgent: Record<number, { totalRembourse: number; nbOps: number; pdvIds: Set<number> }> = {};
    for (const rmb of remboursementsRIA) {
      const agentId = rmb.financement.creditClient?.client?.agentTerrainId;
      if (!agentId) continue;
      if (!parAgent[agentId]) parAgent[agentId] = { totalRembourse: 0, nbOps: 0, pdvIds: new Set() };
      parAgent[agentId].totalRembourse += Number(rmb.montant);
      parAgent[agentId].nbOps++;
      const pdvId = rmb.financement.creditClient?.client?.pointDeVenteId;
      if (pdvId) parAgent[agentId].pdvIds.add(pdvId);
    }

    const agentIds = Object.keys(parAgent).map(Number);
    const agents   = agentIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: agentIds } }, select: { id: true, nom: true, prenom: true } })
      : [];

    const commissionsAgents = agents.map((a) => {
      const stats = parAgent[a.id];
      return {
        agentId:        a.id,
        nom:            `${a.prenom} ${a.nom}`,
        role:           "AGENT_TERRAIN",
        totalRembourse: stats.totalRembourse,
        nbOps:          stats.nbOps,
        taux:           tauxAgent,
        commission:     stats.totalRembourse * (tauxAgent / 100),
      };
    });

    // Agréger par PDV pour chef agence
    const parPdv: Record<number, { totalRembourse: number; nbAgents: number }> = {};
    for (const [agentId, stats] of Object.entries(parAgent)) {
      for (const pdvId of stats.pdvIds) {
        if (!parPdv[pdvId]) parPdv[pdvId] = { totalRembourse: 0, nbAgents: 0 };
        parPdv[pdvId].totalRembourse += (parAgent[Number(agentId)]?.totalRembourse ?? 0);
        parPdv[pdvId].nbAgents++;
      }
    }

    const pdvIds = Object.keys(parPdv).map(Number);
    const chefs  = pdvIds.length > 0
      ? await prisma.gestionnaireAffectation.findMany({
          where: {
            pointDeVenteId: { in: pdvIds },
            actif: true,
            user: { gestionnaire: { role: "CHEF_AGENCE" } },
          },
          select: { pointDeVenteId: true, userId: true, user: { select: { nom: true, prenom: true } } },
        })
      : [];

    const commissionsChefs = chefs.map((c) => {
      const stats = parPdv[c.pointDeVenteId ?? 0];
      if (!stats) return null;
      return {
        agentId:        c.userId,
        nom:            `${c.user.prenom} ${c.user.nom}`,
        role:           "CHEF_AGENCE",
        totalRembourse: stats.totalRembourse,
        nbOps:          stats.nbAgents,
        taux:           tauxChef,
        commission:     stats.totalRembourse * (tauxChef / 100),
      };
    }).filter(Boolean);

    const toutes = [...commissionsAgents, ...commissionsChefs];
    const totalCommissions = toutes.reduce((s, c) => s + (c?.commission ?? 0), 0);

    return NextResponse.json({
      mois, annee, tauxAgent, tauxChef,
      commissions: toutes,
      totaux: { totalCommissions, nbBeneficiaires: toutes.length },
    });
  } catch (error) {
    console.error("POST /api/admin/ria/commissions", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
