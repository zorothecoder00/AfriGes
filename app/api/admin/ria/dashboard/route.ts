import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

export async function GET() {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const now       = new Date();
    const debutJour = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      nbInvestisseurs,
      portefeuilles,
      depots,
      retraits,
      financements,
      nbClientsFinances,
      nbDossiersActifs,
      recouvrementJour,
      recouvrementMois,
      encoursData,
      creancesEchues,
      repartitionRisque,
      financementsDetail,
      remboursementsMeta,
    ] = await Promise.all([
      prisma.gestionnaire.count({ where: { role: "INVESTISSEUR_RIA" } }),

      prisma.portefeuilleRIA.aggregate({
        _sum: {
          capitalInvesti:    true,
          capitalDisponible: true,
          capitalEngage:     true,
          capitalRecouvre:   true,
          capitalBloque:     true,
          beneficesGeneres:    true,
          beneficesDistribues: true,
          beneficesReinvestis: true,
          fondSecurite:        true,
        },
        _count: { id: true },
      }),

      prisma.depotInvestisseur.groupBy({
        by: ["statut"],
        _sum: { montant: true },
        _count: { id: true },
      }),

      prisma.retraitInvestisseur.groupBy({
        by: ["statut"],
        _sum: { montant: true },
        _count: { id: true },
      }),

      prisma.operationFinancementRIA.groupBy({
        by: ["statut"],
        _sum: { encours: true, montantFinance: true, montantRembourse: true },
        _count: { id: true },
      }),

      prisma.affectationClientRIA.findMany({
        where: { actif: true },
        distinct: ["clientId"],
        select: { clientId: true },
      }).then((r) => r.length),

      prisma.operationFinancementRIA.count({ where: { statut: "ACTIF" } }),

      prisma.remboursementRIA.aggregate({
        _sum: { montant: true },
        where: { createdAt: { gte: debutJour } },
      }),

      prisma.remboursementRIA.aggregate({
        _sum: { montant: true },
        where: { createdAt: { gte: debutMois } },
      }),

      prisma.operationFinancementRIA.aggregate({
        _sum: { encours: true },
        where: { statut: { in: ["ACTIF", "EN_RETARD"] } },
      }),

      prisma.operationFinancementRIA.aggregate({
        _sum: { encours: true },
        _count: { id: true },
        where: { statut: "EN_RETARD" },
      }),

      prisma.affectationClientRIA.groupBy({
        by: ["classeRisque"],
        _count: { id: true },
        where: { actif: true },
      }),

      // Détail complet pour indicateurs stratégiques
      prisma.operationFinancementRIA.findMany({
        select: {
          statut: true,
          montantFinance: true,
          montantRembourse: true,
          encours: true,
          dateFinancement: true,
          dateEcheance: true,
          clientId: true,
          client: {
            select: {
              ville: true,
              quartier: true,
              activite: true,
              agentTerrainId: true,
              pointDeVenteId: true,
              agentTerrain: { select: { nom: true, prenom: true } },
              pointDeVente: { select: { nom: true } },
            },
          },
        },
      }),

      // Premier + dernier remboursement par financement (pour DSO)
      prisma.remboursementRIA.findMany({
        select: { montant: true, createdAt: true },
      }),
    ]);

    const toNum = (v: unknown) => Number(v ?? 0);

    // ── KPIs de base ──────────────────────────────────────────────────────────
    const capitalInvesti      = toNum(portefeuilles._sum.capitalInvesti);
    const capitalDisponible   = toNum(portefeuilles._sum.capitalDisponible);
    const capitalEngage       = toNum(portefeuilles._sum.capitalEngage);
    const beneficesGeneres    = toNum(portefeuilles._sum.beneficesGeneres);
    const beneficesDistribues = toNum(portefeuilles._sum.beneficesDistribues);
    const beneficesReinvestis = toNum(portefeuilles._sum.beneficesReinvestis);
    const fondSecurite        = toNum(portefeuilles._sum.fondSecurite);

    const totalFinance   = financements.reduce((s, f) => s + toNum(f._sum.montantFinance),   0);
    const totalRembourse = financements.reduce((s, f) => s + toNum(f._sum.montantRembourse), 0);
    const encoursGlobal  = toNum(encoursData._sum.encours);

    const tauxRemboursement  = totalFinance   > 0 ? (totalRembourse    / totalFinance)   * 100 : 0;
    const tauxRotation       = capitalInvesti > 0 ? (totalFinance      / capitalInvesti) * 100 : 0;
    const rendementMoyen     = capitalInvesti > 0 ? (beneficesGeneres  / capitalInvesti) * 100 : 0;
    const rentabiliteGlobale = capitalInvesti > 0 ? (beneficesDistribues / capitalInvesti) * 100 : 0;

    const statsDepots       = Object.fromEntries(depots.map((d) => [d.statut, { count: d._count.id, montant: toNum(d._sum.montant) }]));
    const statsRetraits     = Object.fromEntries(retraits.map((r) => [r.statut, { count: r._count.id, montant: toNum(r._sum.montant) }]));
    const statsFinancements = Object.fromEntries(financements.map((f) => [f.statut, { count: f._count.id, encours: toNum(f._sum.encours) }]));

    const risqueMap: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    for (const r of repartitionRisque) risqueMap[r.classeRisque] = r._count.id;

    // ── Indicateurs stratégiques ──────────────────────────────────────────────

    // NAV = capital actif net (ce qui reste dans le réseau)
    const navGlobale = capitalDisponible + capitalEngage + beneficesReinvestis + fondSecurite;

    // Taux de réinvestissement
    const tauxReinvestissement = beneficesGeneres > 0 ? (beneficesReinvestis / beneficesGeneres) * 100 : 0;

    // Ratios capital
    const ratioEngageDisponible = capitalDisponible > 0 ? (capitalEngage / capitalDisponible) * 100 : 0;
    const ratioEncoursFonds     = capitalInvesti   > 0 ? (encoursGlobal / capitalInvesti) * 100 : 0;

    // Défauts
    const finsDefaut     = financementsDetail.filter((f) => f.statut === "DEFAUT");
    const nbDefauts      = finsDefaut.length;
    const montantDefaut  = finsDefaut.reduce((s, f) => s + toNum(f.encours), 0);
    const totalFins      = financementsDetail.length;
    const tauxDefaut     = totalFins > 0 ? (nbDefauts / totalFins) * 100 : 0;

    // Créances douteuses (EN_RETARD > 30 jours)
    const finsRetard30 = financementsDetail.filter((f) => {
      if (f.statut !== "EN_RETARD" || !f.dateEcheance) return false;
      return Math.floor((now.getTime() - new Date(f.dateEcheance).getTime()) / 86400000) > 30;
    });
    const montantRetard30 = finsRetard30.reduce((s, f) => s + toNum(f.encours), 0);
    const coutRisque = totalFinance > 0 ? ((montantDefaut + montantRetard30) / totalFinance) * 100 : 0;

    // DSO — average collection days = encours / (totalRembourse/nbJours)
    // nbJours = depuis la première opération
    const finsAvecDate = financementsDetail.filter((f) => f.dateFinancement);
    let dso = 0;
    if (finsAvecDate.length > 0 && totalRembourse > 0) {
      const oldest = Math.min(...finsAvecDate.map((f) => new Date(f.dateFinancement).getTime()));
      const nbJours = Math.max(1, Math.floor((now.getTime() - oldest) / 86400000));
      const rembourseParJour = totalRembourse / nbJours;
      dso = rembourseParJour > 0 ? Math.round(encoursGlobal / rembourseParJour) : 0;
    }

    // Durée moyenne de remboursement (dateEcheance - dateFinancement)
    const finsAvecEcheance = financementsDetail.filter((f) => f.dateFinancement && f.dateEcheance);
    let dureeMoyenneRemboursement = 0;
    if (finsAvecEcheance.length > 0) {
      const totalJours = finsAvecEcheance.reduce((s, f) => {
        const j = Math.floor((new Date(f.dateEcheance!).getTime() - new Date(f.dateFinancement).getTime()) / 86400000);
        return s + Math.max(0, j);
      }, 0);
      dureeMoyenneRemboursement = Math.round(totalJours / finsAvecEcheance.length);
    }

    // Durée moyenne de rotation du capital (jours par cycle)
    const dureeMoyenneRotation = tauxRotation > 0 ? Math.round(365 / (tauxRotation / 100)) : 0;

    // Taux de fidélisation — clients avec ≥ 2 financements
    const clientCounts: Record<number, number> = {};
    for (const f of financementsDetail) clientCounts[f.clientId] = (clientCounts[f.clientId] ?? 0) + 1;
    const totalClientsDistincts = Object.keys(clientCounts).length;
    const clientsFideles        = Object.values(clientCounts).filter((c) => c >= 2).length;
    const tauxFidelisation      = totalClientsDistincts > 0 ? (clientsFideles / totalClientsDistincts) * 100 : 0;

    // Taux de renouvellement ≈ taux de fidélisation (clients qui reviennent)
    const tauxRenouvellement = tauxFidelisation;

    // ── Rendements segmentés ──────────────────────────────────────────────────

    function computeRendements(groupKey: (f: typeof financementsDetail[0]) => string | null) {
      const map: Record<string, { totalFinance: number; totalRecouvre: number; nbFins: number }> = {};
      for (const f of financementsDetail) {
        const key = groupKey(f) ?? "Non renseigné";
        if (!map[key]) map[key] = { totalFinance: 0, totalRecouvre: 0, nbFins: 0 };
        map[key].totalFinance   += toNum(f.montantFinance);
        map[key].totalRecouvre  += toNum(f.montantRembourse);
        map[key].nbFins         += 1;
      }
      return Object.entries(map)
        .filter(([, s]) => s.totalFinance > 0)
        .map(([label, s]) => ({
          label,
          totalFinance: s.totalFinance,
          totalRecouvre: s.totalRecouvre,
          nbFins: s.nbFins,
          rendement: parseFloat(((s.totalRecouvre / s.totalFinance) * 100).toFixed(1)),
        }))
        .sort((a, b) => b.totalRecouvre - a.totalRecouvre)
        .slice(0, 5);
    }

    const rendementParRegion   = computeRendements((f) => f.client?.ville ?? null);
    const rendementParQuartier = computeRendements((f) => f.client?.quartier ?? null);
    const rendementParActivite = computeRendements((f) => f.client?.activite ?? null);
    const rendementParPDV      = computeRendements((f) => f.client?.pointDeVente?.nom ?? null);
    const rendementParAgent    = computeRendements((f) =>
      f.client?.agentTerrain
        ? `${f.client.agentTerrain.prenom} ${f.client.agentTerrain.nom}`
        : null
    );

    // ── Prévisions trésorerie (7 horizons) ───────────────────────────────────
    const horizons = [30, 60, 90, 120, 150, 180, 360];
    const previsionsTresorerie = horizons.map((jours) => {
      const limite   = new Date(now.getTime() + jours * 86_400_000);
      const attendu  = financementsDetail
        .filter((f) => ["ACTIF", "EN_RETARD"].includes(f.statut) && f.dateEcheance && new Date(f.dateEcheance) <= limite)
        .reduce((s, f) => s + toNum(f.encours), 0);
      return { jours, montantAttendu: attendu };
    });

    // ── Projection bénéfices futurs ───────────────────────────────────────────
    // Projection = encours × rendementMoyen/100 (bénéfice estimé sur l'encours restant)
    const projectionBenefices = capitalInvesti > 0
      ? horizons.map((jours) => ({
          jours,
          projection: Math.round(encoursGlobal * (rendementMoyen / 100) * (jours / 365)),
        }))
      : horizons.map((jours) => ({ jours, projection: 0 }));

    // ── Score global de santé ─────────────────────────────────────────────────
    // Composantes pondérées (total = 100)
    const s1 = Math.min(100, tauxRemboursement)               * 0.30;  // Recouvrement
    const s2 = Math.max(0, 100 - Math.min(100, tauxDefaut * 10)) * 0.20; // Défaut inversé (amplifié)
    const s3 = Math.min(100, rendementMoyen * 5)              * 0.20;  // Rendement (5% → 100)
    const s4 = Math.max(0, 100 - Math.min(100, coutRisque * 5)) * 0.15; // Coût du risque inversé
    const s5 = Math.min(100, tauxFidelisation)                * 0.15;  // Fidélisation
    const scoreGlobalSante = Math.round(s1 + s2 + s3 + s4 + s5);

    return NextResponse.json({
      data: {
        // ── Investisseurs & portefeuilles
        nbInvestisseurs,
        nbPortefeuilles:    portefeuilles._count.id,
        nbClientsFinances,
        nbDossiersActifs,

        // ── Capitaux
        capitalInvesti,
        capitalDisponible,
        capitalEngage,
        capitalRecouvre:    toNum(portefeuilles._sum.capitalRecouvre),
        capitalBloque:      toNum(portefeuilles._sum.capitalBloque),

        // ── Bénéfices
        beneficesGeneres,
        beneficesDistribues,
        beneficesReinvestis,
        fondSecurite,

        // ── Recouvrement temps réel
        montantRecouvreDuJour: toNum(recouvrementJour._sum.montant),
        montantRecouvreDuMois: toNum(recouvrementMois._sum.montant),
        encoursGlobal,
        nbCreancesEchues:      creancesEchues._count.id,
        montantCreancesEchues: toNum(creancesEchues._sum.encours),

        // ── Ratios de performance
        tauxRemboursement,
        tauxRotation,
        rendementMoyen,
        rentabiliteGlobale,

        // ── Répartition risque & tableaux opérationnels
        repartitionRisque: risqueMap,
        depots:      statsDepots,
        retraits:    statsRetraits,
        financements: statsFinancements,

        // ── Indicateurs stratégiques
        navGlobale,
        tauxReinvestissement,
        ratioEngageDisponible,
        ratioEncoursFonds,
        nbDefauts,
        montantDefaut,
        tauxDefaut,
        coutRisque,
        dso,
        dureeMoyenneRemboursement,
        dureeMoyenneRotation,
        tauxFidelisation,
        tauxRenouvellement,
        scoreGlobalSante,

        // ── Rendements segmentés
        rendementParRegion,
        rendementParQuartier,
        rendementParActivite,
        rendementParPDV,
        rendementParAgent,

        // ── Projections
        previsionsTresorerie,
        projectionBenefices,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/ria/dashboard", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
