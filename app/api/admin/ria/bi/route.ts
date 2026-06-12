import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

export async function GET() {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const now = new Date();

    const [
      kpisAgg, nbInvestisseurs, top10PfCapital, financementsActifs,
      parClasse, distributions12m,
      allPfsRentabilite, clientsVolumeGrouped, top10ClientsSolvabilite,
      remboursementsRaw, financementsAvecVille, remboursementsAvecVille,
    ] = await Promise.all([
      // KPIs
      prisma.portefeuilleRIA.aggregate({
        _sum: {
          capitalInvesti: true, capitalDisponible: true, capitalEngage: true,
          capitalRecouvre: true, beneficesGeneres: true, beneficesDistribues: true, fondSecurite: true,
        },
        _count: { id: true },
      }),

      prisma.profilInvestisseurRIA.count(),

      // Top 10 portefeuilles par capital investi
      prisma.portefeuilleRIA.findMany({
        select: {
          id: true, reference: true, nom: true,
          capitalInvesti: true, capitalDisponible: true, capitalEngage: true, capitalRecouvre: true, beneficesGeneres: true,
          profilRIA: { select: { gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } } } },
        },
        orderBy: { capitalInvesti: "desc" },
        take: 10,
      }),

      // Financements actifs (trésorerie)
      prisma.operationFinancementRIA.findMany({
        where: { statut: { in: ["ACTIF", "EN_RETARD"] } },
        select: { encours: true, dateEcheance: true, statut: true },
      }),

      // Répartition risque
      prisma.affectationClientRIA.groupBy({
        by: ["classeRisque"],
        _count: { id: true },
        where: { actif: true },
      }),

      // Évolution mensuelle bénéfices
      prisma.distributionBenefice.findMany({
        where: {
          statut: "DISTRIBUE",
          datePaiement: { gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) },
        },
        select: { mois: true, annee: true, montantDistribue: true, montantGenere: true },
      }),

      // Tous portfolios pour rentabilité (trié en mémoire)
      prisma.portefeuilleRIA.findMany({
        where: { capitalInvesti: { gt: 0 } },
        select: {
          id: true, reference: true, nom: true, capitalInvesti: true, beneficesGeneres: true,
          profilRIA: { select: { gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } } } },
        },
      }),

      // Top 10 clients par volume (groupBy clientId)
      prisma.operationFinancementRIA.groupBy({
        by: ["clientId"],
        _sum: { montantFinance: true },
        _count: true,
        orderBy: { _sum: { montantFinance: "desc" } },
        take: 10,
      }),

      // Top 10 clients par solvabilité
      prisma.client.findMany({
        where: { scoreSolvabilite: { not: null, gt: 0 } },
        select: { id: true, nom: true, prenom: true, telephone: true, scoreSolvabilite: true, niveauRisque: true, ville: true },
        orderBy: { scoreSolvabilite: "desc" },
        take: 10,
      }),

      // Remboursements avec info agent (pour top agents)
      prisma.remboursementRIA.findMany({
        select: {
          montant: true,
          financement: {
            select: {
              client: {
                select: {
                  agentTerrainId: true,
                  agentTerrain: { select: { id: true, nom: true, prenom: true } },
                },
              },
            },
          },
        },
      }),

      // Financements avec ville (pour top régions)
      prisma.operationFinancementRIA.findMany({
        select: { montantFinance: true, client: { select: { ville: true } } },
      }),

      // Remboursements avec ville (pour top régions)
      prisma.remboursementRIA.findMany({
        select: { montant: true, financement: { select: { client: { select: { ville: true } } } } },
      }),
    ]);

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const s = kpisAgg._sum;
    const capitalEngage   = Number(s.capitalEngage   ?? 0);
    const capitalRecouvre = Number(s.capitalRecouvre ?? 0);
    const totalFinanceAll = capitalEngage + capitalRecouvre;

    const kpis = {
      capitalTotal:           Number(s.capitalInvesti      ?? 0),
      capitalDisponible:      Number(s.capitalDisponible   ?? 0),
      capitalEngage,
      capitalRecouvre,
      beneficesGeneres:       Number(s.beneficesGeneres    ?? 0),
      beneficesDistribues:    Number(s.beneficesDistribues ?? 0),
      fondSecurite:           Number(s.fondSecurite        ?? 0),
      nbPortefeuilles:        kpisAgg._count.id,
      nbInvestisseurs,
      nbFinancementsActifs:   financementsActifs.filter((f) => f.statut === "ACTIF").length,
      nbFinancementsEnRetard: financementsActifs.filter((f) => f.statut === "EN_RETARD").length,
      totalEncours:           financementsActifs.reduce((acc, f) => acc + Number(f.encours), 0),
      tauxRecouvrement:       totalFinanceAll > 0
        ? Math.round((capitalRecouvre / totalFinanceAll) * 1000) / 10 : 0,
    };

    // ── Top 10 par capital ────────────────────────────────────────────────────
    const top10Capital = top10PfCapital.map((pf) => ({
      id: pf.id, reference: pf.reference, nom: pf.nom,
      investisseur: pf.profilRIA?.gestionnaire?.member
        ? `${pf.profilRIA.gestionnaire.member.prenom} ${pf.profilRIA.gestionnaire.member.nom}` : "—",
      capitalInvesti:    Number(pf.capitalInvesti),
      capitalDisponible: Number(pf.capitalDisponible),
      capitalEngage:     Number(pf.capitalEngage),
      capitalRecouvre:   Number(pf.capitalRecouvre),
      beneficesGeneres:  Number(pf.beneficesGeneres),
    }));

    // ── Top 10 par rentabilité (ROI = bénéfices / capital investi) ────────────
    const top10Rentabilite = allPfsRentabilite
      .map((pf) => {
        const cap = Number(pf.capitalInvesti);
        const ben = Number(pf.beneficesGeneres);
        return {
          id: pf.id, reference: pf.reference, nom: pf.nom,
          investisseur: pf.profilRIA?.gestionnaire?.member
            ? `${pf.profilRIA.gestionnaire.member.prenom} ${pf.profilRIA.gestionnaire.member.nom}` : "—",
          capitalInvesti:   cap,
          beneficesGeneres: ben,
          roi:              cap > 0 ? parseFloat(((ben / cap) * 100).toFixed(2)) : 0,
        };
      })
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 10);

    // ── Top 10 clients par volume ─────────────────────────────────────────────
    const clientIds = clientsVolumeGrouped.map((c) => c.clientId);
    const clientsInfo = clientIds.length > 0
      ? await prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, nom: true, prenom: true, telephone: true, ville: true },
        })
      : [];

    const top10ClientsVolume = clientsVolumeGrouped.map((g) => {
      const c = clientsInfo.find((cl) => cl.id === g.clientId);
      return {
        clientId:       g.clientId,
        nom:            c ? `${c.prenom} ${c.nom}` : `Client #${g.clientId}`,
        telephone:      c?.telephone ?? null,
        ville:          c?.ville ?? null,
        totalFinance:   Number(g._sum.montantFinance ?? 0),
        nbFinancements: g._count,
      };
    });

    // ── Top 10 clients par solvabilité ────────────────────────────────────────
    const top10SolvabiliteClients = top10ClientsSolvabilite.map((c) => ({
      id: c.id,
      nom: `${c.prenom} ${c.nom}`,
      telephone: c.telephone,
      ville: c.ville,
      score: c.scoreSolvabilite ?? 0,
      niveau: c.niveauRisque,
    }));

    // ── Top agents par recouvrement ────────────────────────────────────────────
    const agentMap: Record<number, { id: number; nom: string; prenom: string; totalRecouvre: number; nbRemboursements: number }> = {};
    for (const r of remboursementsRaw) {
      const agent = r.financement?.client?.agentTerrain;
      if (!agent) continue;
      if (!agentMap[agent.id]) {
        agentMap[agent.id] = { id: agent.id, nom: agent.nom, prenom: agent.prenom, totalRecouvre: 0, nbRemboursements: 0 };
      }
      agentMap[agent.id].totalRecouvre   += Number(r.montant);
      agentMap[agent.id].nbRemboursements += 1;
    }
    const topAgents = Object.values(agentMap)
      .sort((a, b) => b.totalRecouvre - a.totalRecouvre)
      .slice(0, 10)
      .map((a) => ({ ...a, nom: `${a.prenom} ${a.nom}` }));

    // ── Top régions par rendement ─────────────────────────────────────────────
    const regionMap: Record<string, { nbFinancements: number; totalFinance: number; totalRecouvre: number }> = {};
    for (const f of financementsAvecVille) {
      const ville = f.client?.ville?.trim() || "Non renseignée";
      if (!regionMap[ville]) regionMap[ville] = { nbFinancements: 0, totalFinance: 0, totalRecouvre: 0 };
      regionMap[ville].nbFinancements++;
      regionMap[ville].totalFinance += Number(f.montantFinance);
    }
    for (const r of remboursementsAvecVille) {
      const ville = r.financement?.client?.ville?.trim() || "Non renseignée";
      if (!regionMap[ville]) regionMap[ville] = { nbFinancements: 0, totalFinance: 0, totalRecouvre: 0 };
      regionMap[ville].totalRecouvre += Number(r.montant);
    }
    const topRegions = Object.entries(regionMap)
      .filter(([, s]) => s.totalFinance > 0)
      .map(([ville, stats]) => ({
        ville,
        nbFinancements: stats.nbFinancements,
        totalFinance:   stats.totalFinance,
        totalRecouvre:  stats.totalRecouvre,
        rendement:      parseFloat(((stats.totalRecouvre / stats.totalFinance) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.totalRecouvre - a.totalRecouvre)
      .slice(0, 10);

    // ── Prévisions trésorerie ──────────────────────────────────────────────────
    const horizons = [30, 60, 90, 180, 360];
    const previsionsTresorerie = horizons.map((jours) => {
      const limite  = new Date(now.getTime() + jours * 86_400_000);
      const attendu = financementsActifs
        .filter((f) => f.dateEcheance && new Date(f.dateEcheance) <= limite)
        .reduce((acc, f) => acc + Number(f.encours), 0);
      return { jours, montantAttendu: attendu };
    });

    const encoursEchus = financementsActifs
      .filter((f) => f.statut === "EN_RETARD" && f.dateEcheance && new Date(f.dateEcheance) < now)
      .reduce((acc, f) => acc + Number(f.encours), 0);

    // ── Répartition risque ────────────────────────────────────────────────────
    const repartitionRisque = parClasse.map((c) => ({ classe: c.classeRisque, count: c._count.id }));

    // ── Évolution mensuelle ───────────────────────────────────────────────────
    const evolutionMap: Record<string, { mois: number; annee: number; distribue: number; genere: number }> = {};
    for (const d of distributions12m) {
      const key = `${d.annee}-${String(d.mois).padStart(2, "0")}`;
      if (!evolutionMap[key]) evolutionMap[key] = { mois: d.mois, annee: d.annee, distribue: 0, genere: 0 };
      evolutionMap[key].distribue += Number(d.montantDistribue);
      evolutionMap[key].genere    += Number(d.montantGenere);
    }
    const evolutionMensuelle = Object.values(evolutionMap).sort((a, b) =>
      a.annee !== b.annee ? a.annee - b.annee : a.mois - b.mois
    );

    return NextResponse.json({
      kpis,
      top10Capital,
      top10Rentabilite,
      top10ClientsVolume,
      top10ClientsSolvabilite: top10SolvabiliteClients,
      topAgents,
      topRegions,
      previsionsTresorerie,
      encoursEchus,
      repartitionRisque,
      evolutionMensuelle,
      // Alias pour compatibilité
      top10Portefeuilles: top10Capital,
    });
  } catch (error) {
    console.error("GET /api/admin/ria/bi", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
