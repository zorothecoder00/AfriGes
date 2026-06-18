import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

/**
 * KPIs légers pour les onglets de la Commission Optimisation
 * (Cartographie des Processus, Goulots, Productivité).
 *
 * Contrairement à /api/admin/ria/dashboard, cette route n'exécute que des
 * agrégations SQL (aggregate / groupBy / count) — aucun findMany à jointures —
 * et reproduit à l'identique les KPIs consommés par ces onglets, dont
 * `scoreGlobalSante` et `tauxDefaut`.
 */
export async function GET() {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const now    = new Date();
    const ilya30j = new Date(now.getTime() - 30 * 86_400_000);

    const [
      portefeuilles,
      financements,
      nbInvestisseurs,
      clientsFinances,
      retard30,
      financementsParClient,
      depotsEnAttente,
      retraitsEnAttente,
    ] = await Promise.all([
      prisma.portefeuilleRIA.aggregate({
        _sum: {
          capitalInvesti:    true,
          capitalDisponible: true,
          capitalEngage:     true,
          beneficesGeneres:  true,
        },
        _count: { id: true },
      }),

      prisma.operationFinancementRIA.groupBy({
        by: ["statut"],
        _sum: { encours: true, montantFinance: true, montantRembourse: true },
        _count: { id: true },
      }),

      prisma.profilInvestisseurRIA.count(),

      prisma.affectationClientRIA.findMany({
        where: { actif: true },
        distinct: ["clientId"],
        select: { clientId: true },
      }).then((r) => r.length),

      // Créances douteuses : EN_RETARD avec échéance dépassée de plus de 30 jours
      prisma.operationFinancementRIA.aggregate({
        _sum: { encours: true },
        where: { statut: "EN_RETARD", dateEcheance: { lt: ilya30j } },
      }),

      // Nombre de financements par client (pour le taux de fidélisation) — agrégé en SQL
      prisma.operationFinancementRIA.groupBy({
        by: ["clientId"],
        _count: { id: true },
      }),

      prisma.depotInvestisseur.count({ where: { statut: "EN_ATTENTE" } }),
      prisma.retraitInvestisseur.count({ where: { statut: "EN_ATTENTE" } }),
    ]);

    const toNum = (v: unknown) => Number(v ?? 0);

    const capitalInvesti    = toNum(portefeuilles._sum.capitalInvesti);
    const capitalDisponible = toNum(portefeuilles._sum.capitalDisponible);
    const capitalEngage     = toNum(portefeuilles._sum.capitalEngage);
    const beneficesGeneres  = toNum(portefeuilles._sum.beneficesGeneres);

    const totalFinance   = financements.reduce((s, f) => s + toNum(f._sum.montantFinance),   0);
    const totalRembourse = financements.reduce((s, f) => s + toNum(f._sum.montantRembourse), 0);
    const totalFins      = financements.reduce((s, f) => s + f._count.id, 0);

    const defautRow     = financements.find((f) => f.statut === "DEFAUT");
    const nbDefauts     = defautRow?._count.id ?? 0;
    const montantDefaut = toNum(defautRow?._sum.encours);
    const montantRetard30 = toNum(retard30._sum.encours);

    const tauxRemboursement = totalFinance   > 0 ? (totalRembourse   / totalFinance)   * 100 : 0;
    const rendementMoyen    = capitalInvesti > 0 ? (beneficesGeneres / capitalInvesti) * 100 : 0;
    const tauxDefaut        = totalFins      > 0 ? (nbDefauts        / totalFins)       * 100 : 0;
    const coutRisque        = totalFinance   > 0 ? ((montantDefaut + montantRetard30) / totalFinance) * 100 : 0;

    const totalClientsDistincts = financementsParClient.length;
    const clientsFideles        = financementsParClient.filter((c) => c._count.id >= 2).length;
    const tauxFidelisation      = totalClientsDistincts > 0 ? (clientsFideles / totalClientsDistincts) * 100 : 0;

    // Score global de santé — formule identique à /api/admin/ria/dashboard
    const s1 = Math.min(100, tauxRemboursement)                 * 0.30;
    const s2 = Math.max(0, 100 - Math.min(100, tauxDefaut * 10)) * 0.20;
    const s3 = Math.min(100, rendementMoyen * 5)                * 0.20;
    const s4 = Math.max(0, 100 - Math.min(100, coutRisque * 5)) * 0.15;
    const s5 = Math.min(100, tauxFidelisation)                  * 0.15;
    const scoreGlobalSante = Math.round(s1 + s2 + s3 + s4 + s5);

    return NextResponse.json({
      data: {
        capitalInvesti,
        capitalDisponible,
        capitalEngage,
        beneficesGeneres,
        nbInvestisseurs,
        nbPortefeuilles: portefeuilles._count.id,
        nbClientsFinances: clientsFinances,
        tauxRemboursement,
        rendementMoyen,
        tauxDefaut,
        scoreGlobalSante,
        depotsEnAttente,
        retraitsEnAttente,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/ria/commissions/gouvernance/optimisation-kpis", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
