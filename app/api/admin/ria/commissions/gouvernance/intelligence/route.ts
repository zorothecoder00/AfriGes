import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

// Centre d'Intelligence Décisionnelle — agrège automatiquement les alertes du système
export async function GET() {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const now = new Date();
    const il30jours = new Date(now.getTime() - 30 * 86_400_000);

    const [
      anomaliesActives,
      portefeillesEnDanger,
      investisseursARisque,
      clientsDefaillants,
      agencesSousPerformantes,
      regionsRentables,
      opportunites,
      dossiersEnAttente,
      reunionsPlanifiees,
      plansEnRetard,
    ] = await Promise.all([

      // Anomalies gouvernance non résolues (critique et majeures)
      prisma.anomalieGouvRIA.findMany({
        where: { resolue: false, niveau: { in: ["CRITIQUE", "MAJEURE"] } },
        orderBy: [{ niveau: "asc" }, { createdAt: "desc" }],
        take: 20,
      }),

      // Portefeuilles en danger (capital disponible < 10% du capital investi)
      prisma.portefeuilleRIA.findMany({
        where: { actif: true },
        select: {
          id: true, reference: true, nom: true,
          capitalInvesti: true, capitalDisponible: true, capitalEngage: true,
          profilRIA: {
            select: {
              gestionnaire: {
                select: { member: { select: { nom: true, prenom: true } } },
              },
            },
          },
        },
      }).then((pfs) =>
        pfs.filter((pf) => {
          const investi = Number(pf.capitalInvesti);
          const dispo   = Number(pf.capitalDisponible);
          return investi > 0 && dispo / investi < 0.1;
        })
      ),

      // Investisseurs à risque (portefeuille avec engagements > 80% du capital investi)
      prisma.portefeuilleRIA.findMany({
        where: { actif: true },
        select: {
          id: true, reference: true,
          capitalInvesti: true, capitalEngage: true,
          profilRIA: {
            select: {
              gestionnaire: {
                select: { member: { select: { id: true, nom: true, prenom: true } } },
              },
            },
          },
        },
      }).then((pfs) =>
        pfs.filter((pf) => {
          const investi = Number(pf.capitalInvesti);
          const engage  = Number(pf.capitalEngage);
          return investi > 0 && engage / investi > 0.8;
        }).slice(0, 10)
      ),

      // Clients défaillants (financements EN_RETARD)
      prisma.operationFinancementRIA.findMany({
        where: { statut: "EN_RETARD" },
        select: {
          id: true, reference: true, encours: true, dateEcheance: true,
          client: { select: { id: true, nom: true, prenom: true, telephone: true, ville: true } },
        },
        orderBy: { encours: "desc" },
        take: 20,
      }),

      // Agences sous-performantes (taux de recouvrement < 50% sur 30j)
      prisma.operationFinancementRIA.groupBy({
        by:    ["clientId"],
        where: { createdAt: { gte: il30jours } },
        _sum:  { montantRembourse: true, montantFinance: true },
      }).then(async (grouped) => {
        const sousPerf = grouped.filter((g) => {
          const finance   = Number(g._sum.montantFinance ?? 0);
          const rembourse = Number(g._sum.montantRembourse ?? 0);
          return finance > 0 && rembourse / finance < 0.5;
        });
        if (sousPerf.length === 0) return [];
        const clientIds = sousPerf.map((g) => g.clientId);
        return prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, nom: true, prenom: true, pointDeVente: { select: { nom: true } } },
          take: 10,
        });
      }),

      // Régions les plus rentables
      prisma.operationFinancementRIA.findMany({
        where: { statut: { in: ["ACTIF", "REMBOURSE"] } },
        select: {
          montantFinance: true, montantRembourse: true,
          client: { select: { ville: true } },
        },
      }).then((fins) => {
        const map: Record<string, { finance: number; rembourse: number; nb: number }> = {};
        for (const f of fins) {
          const ville = f.client?.ville ?? "Non renseigné";
          if (!map[ville]) map[ville] = { finance: 0, rembourse: 0, nb: 0 };
          map[ville].finance   += Number(f.montantFinance);
          map[ville].rembourse += Number(f.montantRembourse);
          map[ville].nb        += 1;
        }
        return Object.entries(map)
          .filter(([, v]) => v.finance > 0)
          .map(([ville, v]) => ({ ville, ...v, taux: (v.rembourse / v.finance) * 100 }))
          .sort((a, b) => b.taux - a.taux)
          .slice(0, 5);
      }),

      // Opportunités d'investissement (capital disponible élevé ≥ 500k)
      prisma.portefeuilleRIA.findMany({
        where: { actif: true, capitalDisponible: { gte: 500000 } },
        select: {
          id: true, reference: true, nom: true, capitalDisponible: true,
          profilRIA: {
            select: {
              gestionnaire: {
                select: { member: { select: { nom: true, prenom: true } } },
              },
            },
          },
        },
        orderBy: { capitalDisponible: "desc" },
        take: 10,
      }),

      // Dossiers inter-commissions en attente de décision
      prisma.dossierInterCommission.findMany({
        where: { statut: { in: ["EN_ANALYSE", "EN_ATTENTE_DECISION", "RECU"] } },
        select: {
          id: true, reference: true, titre: true, statut: true,
          commissionEmettrice: true, commissionReceptrice: true,
          montantDemande: true, createdAt: true,
        },
        orderBy: { createdAt: "asc" },
        take: 10,
      }),

      // Prochaines réunions planifiées
      prisma.reunionCommissionRIA.findMany({
        where: { statut: "PLANIFIEE", dateHeure: { gte: now } },
        select: {
          id: true, titre: true, typeCommission: true, dateHeure: true, lieu: true,
        },
        orderBy: { dateHeure: "asc" },
        take: 5,
      }),

      // Plans d'action en retard
      prisma.planActionCommRIA.findMany({
        where: {
          statut: { notIn: ["TERMINE", "REALISE", "ABANDONNE"] },
          dateEcheance: { lt: now },
        },
        select: {
          id: true, titre: true, typeCommission: true, dateEcheance: true, priorite: true,
          responsable: { select: { id: true, nom: true, prenom: true } },
        },
        orderBy: { dateEcheance: "asc" },
        take: 20,
      }),
    ]);

    return NextResponse.json({
      anomaliesActives,
      portefeillesEnDanger,
      investisseursARisque,
      clientsDefaillants,
      agencesSousPerformantes,
      regionsRentables,
      opportunites,
      dossiersEnAttente,
      reunionsPlanifiees,
      plansEnRetard,
      meta: {
        genereLe: now.toISOString(),
        nbAlertesCritiques: anomaliesActives.filter((a) => a.niveau === "CRITIQUE").length,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
