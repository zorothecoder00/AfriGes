import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

/**
 * GET /api/admin/ria/bi
 * Tableau de bord analytique RIA :
 * - KPIs globaux
 * - Top 10 portefeuilles par capitalInvesti
 * - Prévisions trésorerie 30/60/90/180/360j (encours attendus par horizon)
 * - Répartition par classe de risque
 * - Évolution mensuelle des bénéfices (12 derniers mois)
 */
export async function GET() {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const now = new Date();

    const [kpisAgg, nbInvestisseurs, top10Pf, financementsActifs, parClasse, distributions12m] =
      await Promise.all([
        // KPIs agrégés
        prisma.portefeuilleRIA.aggregate({
          _sum: {
            capitalInvesti:      true,
            capitalDisponible:   true,
            capitalEngage:       true,
            capitalRecouvre:     true,
            beneficesGeneres:    true,
            beneficesDistribues: true,
            fondSecurite:        true,
          },
          _count: { id: true },
        }),

        // Nb investisseurs actifs
        prisma.profilInvestisseurRIA.count(),

        // Top 10 portefeuilles
        prisma.portefeuilleRIA.findMany({
          select: {
            id:                true,
            reference:         true,
            nom:               true,
            capitalInvesti:    true,
            capitalDisponible: true,
            capitalEngage:     true,
            capitalRecouvre:   true,
            beneficesGeneres:  true,
            profilRIA: {
              select: { gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } } },
            },
          },
          orderBy: { capitalInvesti: "desc" },
          take: 10,
        }),

        // Financements actifs pour prévisions trésorerie
        prisma.operationFinancementRIA.findMany({
          where: { statut: { in: ["ACTIF", "EN_RETARD"] } },
          select: { encours: true, dateEcheance: true, statut: true },
        }),

        // Répartition par classe de risque
        prisma.affectationClientRIA.groupBy({
          by: ["classeRisque"],
          _count: { id: true },
          where: { actif: true },
        }),

        // Distributions des 12 derniers mois (bénéfices distribués)
        prisma.distributionBenefice.findMany({
          where: {
            statut: "DISTRIBUE",
            datePaiement: { gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) },
          },
          select: { mois: true, annee: true, montantDistribue: true, montantGenere: true },
        }),
      ]);

    // ── KPIs ─────────────────────────────────────────────────────────────────
    const s = kpisAgg._sum;
    const capitalEngage   = Number(s.capitalEngage   ?? 0);
    const capitalRecouvre = Number(s.capitalRecouvre ?? 0);
    const totalFinanceAll = capitalEngage + capitalRecouvre;

    const kpis = {
      capitalTotal:          Number(s.capitalInvesti      ?? 0),
      capitalDisponible:     Number(s.capitalDisponible   ?? 0),
      capitalEngage,
      capitalRecouvre,
      beneficesGeneres:      Number(s.beneficesGeneres    ?? 0),
      beneficesDistribues:   Number(s.beneficesDistribues ?? 0),
      fondSecurite:          Number(s.fondSecurite        ?? 0),
      nbPortefeuilles:       kpisAgg._count.id,
      nbInvestisseurs,
      nbFinancementsActifs:  financementsActifs.filter((f) => f.statut === "ACTIF").length,
      nbFinancementsEnRetard:financementsActifs.filter((f) => f.statut === "EN_RETARD").length,
      totalEncours:          financementsActifs.reduce((acc, f) => acc + Number(f.encours), 0),
      tauxRecouvrement:      totalFinanceAll > 0
        ? Math.round((capitalRecouvre / totalFinanceAll) * 1000) / 10
        : 0,
    };

    // ── Top 10 ───────────────────────────────────────────────────────────────
    const top10 = top10Pf.map((pf) => ({
      id:                pf.id,
      reference:         pf.reference,
      nom:               pf.nom,
      investisseur:      pf.profilRIA?.gestionnaire?.member
        ? `${pf.profilRIA.gestionnaire.member.prenom} ${pf.profilRIA.gestionnaire.member.nom}`
        : "—",
      capitalInvesti:    Number(pf.capitalInvesti),
      capitalDisponible: Number(pf.capitalDisponible),
      capitalEngage:     Number(pf.capitalEngage),
      beneficesGeneres:  Number(pf.beneficesGeneres),
    }));

    // ── Prévisions trésorerie (cumulatif par horizon) ─────────────────────────
    const horizons = [30, 60, 90, 180, 360];
    const previsionsTresorerie = horizons.map((jours) => {
      const limite = new Date(now.getTime() + jours * 86_400_000);
      const attendu = financementsActifs
        .filter((f) => f.dateEcheance && new Date(f.dateEcheance) <= limite)
        .reduce((acc, f) => acc + Number(f.encours), 0);
      return { jours, montantAttendu: attendu };
    });

    // Encours échus (déjà en retard, capital non récupéré)
    const encoursEchus = financementsActifs
      .filter((f) => f.statut === "EN_RETARD" && f.dateEcheance && new Date(f.dateEcheance) < now)
      .reduce((acc, f) => acc + Number(f.encours), 0);

    // ── Répartition risque ────────────────────────────────────────────────────
    const repartitionRisque = parClasse.map((c) => ({
      classe: c.classeRisque,
      count:  c._count.id,
    }));

    // ── Évolution mensuelle bénéfices (12 mois) ────────────────────────────────
    const evolutionMensuelle: Record<string, { mois: number; annee: number; distribue: number; genere: number }> = {};
    for (const d of distributions12m) {
      const key = `${d.annee}-${String(d.mois).padStart(2, "0")}`;
      if (!evolutionMensuelle[key]) {
        evolutionMensuelle[key] = { mois: d.mois, annee: d.annee, distribue: 0, genere: 0 };
      }
      evolutionMensuelle[key].distribue += Number(d.montantDistribue);
      evolutionMensuelle[key].genere    += Number(d.montantGenere);
    }
    const evolution = Object.values(evolutionMensuelle).sort((a, b) =>
      a.annee !== b.annee ? a.annee - b.annee : a.mois - b.mois
    );

    return NextResponse.json({
      kpis,
      top10Portefeuilles: top10,
      previsionsTresorerie,
      encoursEchus,
      repartitionRisque,
      evolutionMensuelle: evolution,
    });
  } catch (error) {
    console.error("GET /api/admin/ria/bi", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
