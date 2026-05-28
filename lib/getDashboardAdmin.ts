import { prisma } from "@/lib/prisma";
import { MemberStatus } from "@prisma/client";

// ─── Dashboard Décisionnel (Module 8) ────────────────────────────────────────

export async function getDashboardDecisionnel() {
  const now = new Date();

  // Bornes "aujourd'hui"
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  // Bornes "30 derniers jours" pour classement agents
  const since30 = new Date(now);
  since30.setDate(since30.getDate() - 30);

  // ── 8.1 KPIs créances ───────────────────────────────────────────────────

  const [
    clientsDebiteurs,
    creancesAgg,
    retardsCritiques,
    versementsJourAgg,
    remboursementsJourAgg,
    creditsAgg,
    pertesAgg,
    creancesARisque,
    cashAttenduAgg,
  ] = await Promise.all([
    // Clients avec au moins un crédit actif (solde > 0)
    prisma.client.count({
      where: {
        creditsClients: {
          some: { statut: { in: ["ACTIF", "EN_RETARD"] }, soldeRestant: { gt: 0 } },
        },
      },
    }),

    // Créances totales = somme des soldes restants actifs/en retard
    prisma.creditClient.aggregate({
      where: { statut: { in: ["ACTIF", "EN_RETARD"] } },
      _sum: { soldeRestant: true },
    }),

    // Retards critiques = nombre de crédits EN_RETARD
    prisma.creditClient.count({ where: { statut: "EN_RETARD" } }),

    // Collecte du jour — versements packs
    prisma.versementPack.aggregate({
      where: { datePaiement: { gte: todayStart, lte: todayEnd } },
      _sum: { montant: true },
    }),

    // Collecte du jour — remboursements crédits
    prisma.remboursementCredit.aggregate({
      where: { dateRemboursement: { gte: todayStart, lte: todayEnd } },
      _sum: { montant: true },
    }),

    // Taux remboursement global
    prisma.creditClient.aggregate({
      where: { statut: { in: ["ACTIF", "EN_RETARD", "SOLDE"] } },
      _sum: { montantTotal: true, montantRembourse: true },
    }),

    // Pertes potentielles = soldes des crédits EN_RETARD avec clients à risque élevé/critique
    prisma.creditClient.aggregate({
      where: {
        statut: "EN_RETARD",
        client: { niveauRisque: { in: ["ELEVE", "CRITIQUE"] } },
      },
      _sum: { soldeRestant: true },
    }),

    // Créances à risque = nombre de crédits actifs/retard avec client ELEVE/CRITIQUE
    prisma.creditClient.count({
      where: {
        statut: { in: ["ACTIF", "EN_RETARD"] },
        client: { niveauRisque: { in: ["ELEVE", "CRITIQUE"] } },
      },
    }),

    // Cash attendu aujourd'hui = échéances dues aujourd'hui non payées
    prisma.echeanceCredit.aggregate({
      where: {
        statut: { in: ["EN_ATTENTE", "EN_RETARD"] },
        dateEcheance: { gte: todayStart, lte: todayEnd },
      },
      _sum: { montantDu: true },
    }),
  ]);

  const montantCollecteJour =
    Number(versementsJourAgg._sum.montant ?? 0) +
    Number(remboursementsJourAgg._sum.montant ?? 0);

  const totalMontant = Number(creditsAgg._sum.montantTotal ?? 0);
  const totalRembourse = Number(creditsAgg._sum.montantRembourse ?? 0);
  const tauxRemboursement = totalMontant > 0
    ? Math.round((totalRembourse / totalMontant) * 100)
    : 0;

  // ── Classement des agents (30 derniers jours) ────────────────────────────
  // Toutes les sources : versements packs + remboursements crédits + ventes directes

  // IDs des agents terrain actifs
  const agentTerrainRecords = await prisma.gestionnaire.findMany({
    where: { role: "AGENT_TERRAIN", actif: true },
    select: { memberId: true },
  });
  const agentTerrainIds = agentTerrainRecords.map((g) => g.memberId);

  const [versementsParAgent, remboursementsParAgent, ventesParAgent, collectesParAgent] =
    agentTerrainIds.length > 0
      ? await Promise.all([
          // Versements packs encaissés directement par l'agent (encaisseParId = agent)
          // Note : les VersementPack issus de validation de collecte ont encaisseParId = admin
          // → pas de double comptage avec collectesParAgent
          prisma.versementPack.groupBy({
            by: ["encaisseParId"],
            where: {
              encaisseParId: { in: agentTerrainIds },
              datePaiement: { gte: since30 },
              statut: "PAYE",
            },
            _sum: { montant: true },
          }),
          // Remboursements crédits enregistrés par l'agent
          prisma.remboursementCredit.groupBy({
            by: ["enregistreParId"],
            where: {
              enregistreParId: { in: agentTerrainIds },
              dateRemboursement: { gte: since30 },
            },
            _sum: { montant: true },
          }),
          // Ventes directes réalisées par l'agent
          prisma.venteDirecte.groupBy({
            by: ["vendeurId"],
            where: {
              vendeurId: { in: agentTerrainIds },
              createdAt: { gte: since30 },
              statut: { notIn: ["ANNULEE", "BROUILLON"] },
            },
            _sum: { montantTotal: true },
          }),
          // Collectes terrain validées (montant physiquement collecté par l'agent)
          prisma.collecteJournaliere.groupBy({
            by: ["agentId"],
            where: {
              agentId: { in: agentTerrainIds },
              statut: "VALIDEE",
              dateCollecte: { gte: since30 },
            },
            _sum: { montantCollecte: true },
          }),
        ])
      : [[], [], [], []];

  // Fusionner les 4 sources par agentId
  const totauxParAgent = new Map<number, number>();
  for (const v of versementsParAgent) {
    if (v.encaisseParId === null) continue;
    const id = v.encaisseParId;
    totauxParAgent.set(id, (totauxParAgent.get(id) ?? 0) + Number(v._sum.montant ?? 0));
  }
  for (const r of remboursementsParAgent) {
    if (r.enregistreParId === null) continue;
    const id = r.enregistreParId;
    totauxParAgent.set(id, (totauxParAgent.get(id) ?? 0) + Number(r._sum.montant ?? 0));
  }
  for (const v of ventesParAgent) {
    if (v.vendeurId === null) continue;
    const id = v.vendeurId;
    totauxParAgent.set(id, (totauxParAgent.get(id) ?? 0) + Number(v._sum.montantTotal ?? 0));
  }
  for (const c of collectesParAgent) {
    const id = c.agentId;
    totauxParAgent.set(id, (totauxParAgent.get(id) ?? 0) + Number(c._sum.montantCollecte ?? 0));
  }

  // Trier et prendre les 5 premiers
  const top5 = [...totauxParAgent.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const top5Ids = top5.map(([id]) => id);
  const agentUsers = top5Ids.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: top5Ids } },
        select: { id: true, nom: true, prenom: true },
      })
    : [];
  const userMap = Object.fromEntries(agentUsers.map((u) => [u.id, u]));

  const agentsPerformants = top5.map(([agentId, montantCollecte], idx) => ({
    rank: idx + 1,
    agentId,
    nom: userMap[agentId]
      ? `${userMap[agentId].prenom ?? ""} ${userMap[agentId].nom ?? ""}`.trim()
      : `Agent #${agentId}`,
    montantCollecte,
  }));

  return {
    // 8.1
    clientsDebiteurs,
    creancesTotales: Number(creancesAgg._sum.soldeRestant ?? 0),
    retardsCritiques,
    montantCollecteJour,
    tauxRemboursement,
    agentsPerformants,
    // 8.2
    encoursGlobal: Number(creancesAgg._sum.soldeRestant ?? 0),
    cashAttendu: Number(cashAttenduAgg._sum.montantDu ?? 0),
    cashCollecte: montantCollecteJour,
    pertesPoentielles: Number(pertesAgg._sum.soldeRestant ?? 0),
    creancesARisque,
  };
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function pctChange(curr: number, prev: number): string {
  if (prev === 0 && curr === 0) return "=";
  if (prev === 0) return "Nouveau";
  const p = ((curr - prev) / prev) * 100;
  return `${p >= 0 ? "+" : ""}${Math.round(p)}%`;
}

function isPositiveChange(curr: number, prev: number): boolean {
  return curr >= prev;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function getDashboardAdmin(period: number = 30) {
  const now = new Date();

  const since = new Date(now);
  since.setDate(since.getDate() - period);

  const prevSince = new Date(now);
  prevSince.setDate(prevSince.getDate() - period * 2);

  // ── 1. Compteurs principaux ──────────────────────────────────────────────

  const [clientsActifs, souscriptionsActives, packsTotal] = await Promise.all([
    prisma.client.count({ where: { etat: MemberStatus.ACTIF } }),
    prisma.souscriptionPack.count({ where: { statut: "ACTIF" } }),
    prisma.pack.count(),
  ]);

  // ── 2. Agrégat global des versements ────────────────────────────────────

  const versementsAgg = await prisma.versementPack.aggregate({
    _sum: { montant: true },
    _count: { id: true },
  });

  // ── 3. Évolution des versements (par jour sur la période) ────────────────

  const versementsRecents = await prisma.versementPack.findMany({
    where: { datePaiement: { gte: since } },
    select: { datePaiement: true, montant: true },
    orderBy: { datePaiement: "asc" },
  });

  const versMap: Record<string, number> = {};
  for (const v of versementsRecents) {
    const k = v.datePaiement.toISOString().split("T")[0];
    versMap[k] = (versMap[k] ?? 0) + Number(v.montant);
  }

  // ── 4. Évolution des montants versés sur souscriptions créées ────────────

  const souscRecentes = await prisma.souscriptionPack.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, montantVerse: true },
    orderBy: { createdAt: "asc" },
  });

  const souscMap: Record<string, number> = {};
  for (const s of souscRecentes) {
    const k = s.createdAt.toISOString().split("T")[0];
    souscMap[k] = (souscMap[k] ?? 0) + Number(s.montantVerse);
  }

  // Tableau jour par jour
  const evolutionVersements: { date: string; montant: number }[] = [];
  const evolutionSouscriptions: { date: string; montant: number }[] = [];
  for (let i = period; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const k = d.toISOString().split("T")[0];
    evolutionVersements.push({ date: k, montant: versMap[k] ?? 0 });
    evolutionSouscriptions.push({ date: k, montant: souscMap[k] ?? 0 });
  }

  // ── 5. Répartition des souscriptions par statut ──────────────────────────

  const [souscActives, souscCompletes, souscAnnulees] = await Promise.all([
    prisma.souscriptionPack.count({ where: { statut: "ACTIF" } }),
    prisma.souscriptionPack.count({ where: { statut: "COMPLETE" } }),
    prisma.souscriptionPack.count({ where: { statut: "ANNULE" } }),
  ]);

  // ── 6. Comparaisons période actuelle vs précédente ───────────────────────

  const [nouvMembresCurr, nouvMembresPrec, versCurr, versPrec] = await Promise.all([
    prisma.client.count({ where: { createdAt: { gte: since } } }),
    prisma.client.count({ where: { createdAt: { gte: prevSince, lt: since } } }),
    prisma.versementPack.aggregate({ where: { datePaiement: { gte: since } },             _sum: { montant: true } }),
    prisma.versementPack.aggregate({ where: { datePaiement: { gte: prevSince, lt: since } }, _sum: { montant: true } }),
  ]);

  const versCurrTotal = Number(versCurr._sum.montant ?? 0);
  const versPrecTotal = Number(versPrec._sum.montant ?? 0);

  // ── 7. Retour ────────────────────────────────────────────────────────────

  return {
    clientsActifs,
    souscriptionsActives,
    packsTotal,
    versementsTotal: {
      count:   versementsAgg._count.id,
      montant: Number(versementsAgg._sum.montant ?? 0),
    },
    evolutionVersements,
    evolutionSouscriptions,
    repartitionSouscriptions: {
      actives:   souscActives,
      completes: souscCompletes,
      annulees:  souscAnnulees,
    },
    comparaisons: {
      clients:    { pct: pctChange(nouvMembresCurr, nouvMembresPrec), positif: isPositiveChange(nouvMembresCurr, nouvMembresPrec) },
      versements: { pct: pctChange(versCurrTotal, versPrecTotal),      positif: isPositiveChange(versCurrTotal, versPrecTotal) },
      packs:      { pct: "—", positif: true },
    },
  };
}
