import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

export async function GET() {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const now = new Date();
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

      // Nb clients distincts avec une affectation active
      prisma.affectationClientRIA.count({ where: { actif: true } }),

      // Dossiers de financement actifs
      prisma.operationFinancementRIA.count({ where: { statut: "ACTIF" } }),

      // Recouvrement du jour (remboursements RIA créés aujourd'hui)
      prisma.remboursementRIA.aggregate({
        _sum: { montant: true },
        where: { createdAt: { gte: debutJour } },
      }),

      // Recouvrement du mois
      prisma.remboursementRIA.aggregate({
        _sum: { montant: true },
        where: { createdAt: { gte: debutMois } },
      }),

      // Encours global (ACTIF + EN_RETARD)
      prisma.operationFinancementRIA.aggregate({
        _sum: { encours: true },
        where: { statut: { in: ["ACTIF", "EN_RETARD"] } },
      }),

      // Créances échues (EN_RETARD)
      prisma.operationFinancementRIA.aggregate({
        _sum: { encours: true },
        _count: { id: true },
        where: { statut: "EN_RETARD" },
      }),

      // Répartition des classes de risque
      prisma.affectationClientRIA.groupBy({
        by: ["classeRisque"],
        _count: { id: true },
        where: { actif: true },
      }),
    ]);

    const toNum = (v: unknown) => Number(v ?? 0);

    const capitalInvesti      = toNum(portefeuilles._sum.capitalInvesti);
    const beneficesGeneres    = toNum(portefeuilles._sum.beneficesGeneres);
    const beneficesDistribues = toNum(portefeuilles._sum.beneficesDistribues);

    const totalFinance   = financements.reduce((s, f) => s + toNum(f._sum.montantFinance),   0);
    const totalRembourse = financements.reduce((s, f) => s + toNum(f._sum.montantRembourse), 0);

    const tauxRemboursement  = totalFinance   > 0 ? (totalRembourse    / totalFinance)   * 100 : 0;
    const tauxRotation       = capitalInvesti > 0 ? (totalFinance      / capitalInvesti) * 100 : 0;
    const rendementMoyen     = capitalInvesti > 0 ? (beneficesGeneres  / capitalInvesti) * 100 : 0;
    const rentabiliteGlobale = capitalInvesti > 0 ? (beneficesDistribues / capitalInvesti) * 100 : 0;

    const statsDepots      = Object.fromEntries(depots.map((d) => [d.statut, { count: d._count.id, montant: toNum(d._sum.montant) }]));
    const statsRetraits    = Object.fromEntries(retraits.map((r) => [r.statut, { count: r._count.id, montant: toNum(r._sum.montant) }]));
    const statsFinancements = Object.fromEntries(financements.map((f) => [f.statut, { count: f._count.id, encours: toNum(f._sum.encours) }]));

    const risqueMap: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    for (const r of repartitionRisque) risqueMap[r.classeRisque] = r._count.id;

    return NextResponse.json({
      data: {
        // Investisseurs & portefeuilles
        nbInvestisseurs,
        nbPortefeuilles:    portefeuilles._count.id,
        nbClientsFinances,
        nbDossiersActifs,

        // Capitaux
        capitalInvesti,
        capitalDisponible:  toNum(portefeuilles._sum.capitalDisponible),
        capitalEngage:      toNum(portefeuilles._sum.capitalEngage),
        capitalRecouvre:    toNum(portefeuilles._sum.capitalRecouvre),
        capitalBloque:      toNum(portefeuilles._sum.capitalBloque),

        // Bénéfices
        beneficesGeneres,
        beneficesDistribues,
        beneficesReinvestis: toNum(portefeuilles._sum.beneficesReinvestis),
        fondSecurite:        toNum(portefeuilles._sum.fondSecurite),

        // Recouvrement temps réel
        montantRecouvreDuJour: toNum(recouvrementJour._sum.montant),
        montantRecouvreDuMois: toNum(recouvrementMois._sum.montant),
        encoursGlobal:         toNum(encoursData._sum.encours),
        nbCreancesEchues:      creancesEchues._count.id,
        montantCreancesEchues: toNum(creancesEchues._sum.encours),

        // Ratios de performance
        tauxRemboursement,
        tauxRotation,
        rendementMoyen,
        rentabiliteGlobale,

        // Répartition risque
        repartitionRisque: risqueMap,

        // Tableaux opérationnels
        depots:      statsDepots,
        retraits:    statsRetraits,
        financements: statsFinancements,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/ria/dashboard", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
