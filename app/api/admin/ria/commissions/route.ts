import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

// ── GET — liste des commissions sauvegardées ───────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = req.nextUrl;
    const mois   = searchParams.get("mois")   ? parseInt(searchParams.get("mois")!)   : new Date().getMonth() + 1;
    const annee  = searchParams.get("annee")  ? parseInt(searchParams.get("annee")!)  : new Date().getFullYear();
    const statut = searchParams.get("statut");

    const commissions = await prisma.commissionAgentRIA.findMany({
      where: {
        mois,
        annee,
        ...(statut ? { statut: statut as import("@prisma/client").StatutCommissionRIA } : {}),
      },
      include: {
        user:        { select: { id: true, nom: true, prenom: true } },
        approuvePar: { select: { id: true, nom: true, prenom: true } },
      },
      orderBy: [{ roleType: "asc" }, { montant: "desc" }],
    });

    const totaux = commissions.reduce(
      (acc, c) => ({
        totalMontant:    acc.totalMontant    + Number(c.montant),
        totalRecouvre:   acc.totalRecouvre   + Number(c.montantRecouvre),
        nbApprouves:     acc.nbApprouves     + (c.statut === "APPROUVE" ? 1 : 0),
        nbPayes:         acc.nbPayes         + (c.statut === "PAYE"     ? 1 : 0),
        nbBeneficiaires: acc.nbBeneficiaires + 1,
      }),
      { totalMontant: 0, totalRecouvre: 0, nbApprouves: 0, nbPayes: 0, nbBeneficiaires: 0 }
    );

    const config = await prisma.configCommissionRIA.findMany({ where: { actif: true } });

    return NextResponse.json({ commissions, totaux, config, mois, annee });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ── POST — calcul et persistance des commissions ──────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body  = await req.json();
    const mois  = parseInt(body.mois  ?? new Date().getMonth() + 1);
    const annee = parseInt(body.annee ?? new Date().getFullYear());

    if (!mois || !annee || mois < 1 || mois > 12) {
      return NextResponse.json({ error: "mois (1-12) et annee sont requis" }, { status: 400 });
    }

    const debut = new Date(annee, mois - 1, 1);
    const fin   = new Date(annee, mois,     1);

    // ── Config des taux ────────────────────────────────────────────────────────
    const configs = await prisma.configCommissionRIA.findMany({ where: { actif: true } });
    const getConfig = (roleType: string) => {
      const c = configs.find((x) => x.roleType === roleType);
      return c ? Number(c.tauxBase) : roleType === "AGENT_TERRAIN" ? 1.0 : roleType === "CHEF_AGENCE" ? 0.5 : 0.3;
    };

    // ── 1. Remboursements RIA de la période ────────────────────────────────────
    const remboursements = await prisma.remboursementRIA.findMany({
      where: { createdAt: { gte: debut, lt: fin } },
      include: {
        financement: {
          include: {
            client: { select: { id: true, agentTerrainId: true, pointDeVenteId: true } },
          },
        },
      },
    });

    // ── Agrégation par agent terrain ───────────────────────────────────────────
    const parAgent: Record<number, { totalRecouvre: number; nbOps: number; pdvIds: Set<number> }> = {};
    for (const r of remboursements) {
      const agentId = r.financement.client?.agentTerrainId;
      if (!agentId) continue;
      if (!parAgent[agentId]) parAgent[agentId] = { totalRecouvre: 0, nbOps: 0, pdvIds: new Set() };
      parAgent[agentId].totalRecouvre += Number(r.montant);
      parAgent[agentId].nbOps++;
      const pdvId = r.financement.client?.pointDeVenteId;
      if (pdvId) parAgent[agentId].pdvIds.add(pdvId);
    }

    // ── Taux de succès par agent ───────────────────────────────────────────────
    const agentIds = Object.keys(parAgent).map(Number);
    const dossiersParAgent: Record<number, { total: number; remb: number }> = {};
    if (agentIds.length > 0) {
      const financements = await prisma.operationFinancementRIA.findMany({
        where: {
          client: { agentTerrainId: { in: agentIds } },
          statut: { not: "ANNULE" },
        },
        select: { clientId: true, statut: true, client: { select: { agentTerrainId: true } } },
      });
      for (const f of financements) {
        const aId = f.client?.agentTerrainId;
        if (!aId) continue;
        if (!dossiersParAgent[aId]) dossiersParAgent[aId] = { total: 0, remb: 0 };
        dossiersParAgent[aId].total++;
        if (f.statut === "REMBOURSE") dossiersParAgent[aId].remb++;
      }
    }

    // ── Infos utilisateurs agents ──────────────────────────────────────────────
    const agentUsers = agentIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: agentIds } }, select: { id: true, nom: true, prenom: true } })
      : [];

    // ── 2. Agrégation par PDV pour RPV ─────────────────────────────────────────
    const parPdv: Record<number, { totalRecouvre: number; nbAgents: number }> = {};
    for (const [agentIdStr, stats] of Object.entries(parAgent)) {
      const agentId = Number(agentIdStr);
      for (const pdvId of stats.pdvIds) {
        if (!parPdv[pdvId]) parPdv[pdvId] = { totalRecouvre: 0, nbAgents: 0 };
        parPdv[pdvId].totalRecouvre += stats.totalRecouvre;
        parPdv[pdvId].nbAgents++;
      }
    }

    // RPV et leurs PDV actifs
    const allPdvIds = Object.keys(parPdv).map(Number);
    const rpvAffectations = allPdvIds.length > 0
      ? await prisma.gestionnaireAffectation.findMany({
          where: {
            pointDeVenteId: { in: allPdvIds },
            actif: true,
            user: { gestionnaire: { role: "RESPONSABLE_POINT_DE_VENTE" } },
          },
          select: { userId: true, pointDeVenteId: true, user: { select: { id: true, nom: true, prenom: true } } },
        })
      : [];

    // Grouper les RPV : userId → set de PDVs
    const parRPV: Record<number, { user: { id: number; nom: string; prenom: string }; pdvIds: Set<number>; totalRecouvre: number }> = {};
    for (const aff of rpvAffectations) {
      if (!parRPV[aff.userId]) parRPV[aff.userId] = { user: aff.user, pdvIds: new Set(), totalRecouvre: 0 };
      parRPV[aff.userId].pdvIds.add(aff.pointDeVenteId);
      parRPV[aff.userId].totalRecouvre += parPdv[aff.pointDeVenteId]?.totalRecouvre ?? 0;
    }

    const tauxAgent    = getConfig("AGENT_TERRAIN");
    const tauxChef     = getConfig("CHEF_AGENCE");
    const tauxRegional = getConfig("RPV_REGIONAL");

    // ── Upsert toutes les commissions ──────────────────────────────────────────
    const upserts: Promise<unknown>[] = [];

    // Agents terrain
    for (const user of agentUsers) {
      const stats   = parAgent[user.id];
      const doss    = dossiersParAgent[user.id] ?? { total: 0, remb: 0 };
      const taux    = tauxAgent;
      const montant = stats.totalRecouvre * (taux / 100);
      const tauxSucces = doss.total > 0 ? (doss.remb / doss.total) * 100 : 0;

      upserts.push(prisma.commissionAgentRIA.upsert({
        where: { userId_mois_annee_roleType: { userId: user.id, mois, annee, roleType: "AGENT_TERRAIN" } },
        create: {
          userId: user.id, mois, annee, roleType: "AGENT_TERRAIN",
          montantRecouvre: stats.totalRecouvre, nbDossiers: doss.total,
          nbDossiersRembourses: doss.remb, tauxSucces,
          taux, montant, statut: "CALCULE",
        },
        update: {
          montantRecouvre: stats.totalRecouvre, nbDossiers: doss.total,
          nbDossiersRembourses: doss.remb, tauxSucces,
          taux, montant, statut: "CALCULE",
        },
      }));
    }

    // RPV chef agence (1 PDV) et régional (2+ PDVs)
    for (const [userIdStr, rpvStats] of Object.entries(parRPV)) {
      const userId   = Number(userIdStr);
      const nbPdvs   = rpvStats.pdvIds.size;
      const roleType = nbPdvs > 1 ? "RPV_REGIONAL" : "CHEF_AGENCE";
      const taux     = nbPdvs > 1 ? tauxRegional : tauxChef;
      const montant  = rpvStats.totalRecouvre * (taux / 100);

      upserts.push(prisma.commissionAgentRIA.upsert({
        where: { userId_mois_annee_roleType: { userId, mois, annee, roleType } },
        create: {
          userId, mois, annee, roleType,
          montantRecouvre: rpvStats.totalRecouvre,
          nbDossiers: nbPdvs,
          nbDossiersRembourses: 0, tauxSucces: 0,
          taux, montant, statut: "CALCULE",
        },
        update: {
          montantRecouvre: rpvStats.totalRecouvre,
          nbDossiers: nbPdvs,
          taux, montant, statut: "CALCULE",
        },
      }));
    }

    await Promise.all(upserts);

    const saved = await prisma.commissionAgentRIA.findMany({
      where: { mois, annee },
      include: { user: { select: { id: true, nom: true, prenom: true } } },
      orderBy: [{ roleType: "asc" }, { montant: "desc" }],
    });

    const totalMontant  = saved.reduce((s, c) => s + Number(c.montant),  0);
    const totalRecouvre = saved.reduce((s, c) => s + Number(c.montantRecouvre), 0);

    return NextResponse.json({
      commissions: saved,
      totaux: { totalMontant, totalRecouvre, nbBeneficiaires: saved.length },
      mois, annee,
    }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
