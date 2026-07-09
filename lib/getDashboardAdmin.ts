import { prisma } from "@/lib/prisma";
import { MemberStatus } from "@prisma/client";

// Statuts de vente directe à ne pas compter comme activité réelle.
const VENTE_EXCLUES = ["ANNULEE", "BROUILLON"] as const;

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
    ventesJourAgg,
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

    // Cash du jour — versements packs
    prisma.versementPack.aggregate({
      where: { datePaiement: { gte: todayStart, lte: todayEnd } },
      _sum: { montant: true },
    }),

    // Cash du jour — remboursements crédits
    prisma.remboursementCredit.aggregate({
      where: { dateRemboursement: { gte: todayStart, lte: todayEnd } },
      _sum: { montant: true },
    }),

    // Cash du jour — ventes directes (cash net encaissé = payé − monnaie rendue)
    prisma.venteDirecte.aggregate({
      where: { createdAt: { gte: todayStart, lte: todayEnd }, statut: { notIn: [...VENTE_EXCLUES] } },
      _sum: { montantPaye: true, monnaieRendue: true },
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

  const ventesCashJour =
    Number(ventesJourAgg._sum.montantPaye ?? 0) - Number(ventesJourAgg._sum.monnaieRendue ?? 0);

  // Cash encaissé du jour = packs + remboursements crédits + ventes directes (cash net).
  const montantCollecteJour =
    Number(versementsJourAgg._sum.montant ?? 0) +
    Number(remboursementsJourAgg._sum.montant ?? 0) +
    Math.max(0, ventesCashJour);

  const totalMontant = Number(creditsAgg._sum.montantTotal ?? 0);
  const totalRembourse = Number(creditsAgg._sum.montantRembourse ?? 0);
  const tauxRemboursement = totalMontant > 0
    ? Math.round((totalRembourse / totalMontant) * 100)
    : 0;

  // ── Classement des agents (30 derniers jours) ────────────────────────────
  // Sources au niveau enregistrement (chacune porte l'id de l'agent) :
  //   versements packs (encaisseParId) + remboursements crédits (enregistreParId)
  //   + ventes directes (vendeurId).
  // NB : le modèle CollecteJournaliere n'est PLUS utilisé ici — son montantCollecte
  // ne fait que ré-agréger ces mêmes versements/remboursements (double comptage).

  const agentTerrainRecords = await prisma.gestionnaire.findMany({
    where: { role: "AGENT_TERRAIN", actif: true },
    select: { memberId: true },
  });
  const agentTerrainIds = agentTerrainRecords.map((g) => g.memberId);

  const [versementsParAgent, remboursementsParAgent, ventesParAgent] =
    agentTerrainIds.length > 0
      ? await Promise.all([
          prisma.versementPack.groupBy({
            by: ["encaisseParId"],
            where: { encaisseParId: { in: agentTerrainIds }, datePaiement: { gte: since30 }, statut: "PAYE" },
            _sum: { montant: true },
          }),
          prisma.remboursementCredit.groupBy({
            by: ["enregistreParId"],
            where: { enregistreParId: { in: agentTerrainIds }, dateRemboursement: { gte: since30 } },
            _sum: { montant: true },
          }),
          prisma.venteDirecte.groupBy({
            by: ["vendeurId"],
            where: { vendeurId: { in: agentTerrainIds }, createdAt: { gte: since30 }, statut: { notIn: [...VENTE_EXCLUES] } },
            _sum: { montantTotal: true },
          }),
        ])
      : [[], [], []];

  const totauxParAgent = new Map<number, number>();
  for (const v of versementsParAgent) {
    if (v.encaisseParId === null) continue;
    totauxParAgent.set(v.encaisseParId, (totauxParAgent.get(v.encaisseParId) ?? 0) + Number(v._sum.montant ?? 0));
  }
  for (const r of remboursementsParAgent) {
    if (r.enregistreParId === null) continue;
    totauxParAgent.set(r.enregistreParId, (totauxParAgent.get(r.enregistreParId) ?? 0) + Number(r._sum.montant ?? 0));
  }
  for (const v of ventesParAgent) {
    if (v.vendeurId === null) continue;
    totauxParAgent.set(v.vendeurId, (totauxParAgent.get(v.vendeurId) ?? 0) + Number(v._sum.montantTotal ?? 0));
  }

  const top5 = [...totauxParAgent.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const top5Ids = top5.map(([id]) => id);
  const agentUsers = top5Ids.length > 0
    ? await prisma.user.findMany({ where: { id: { in: top5Ids } }, select: { id: true, nom: true, prenom: true } })
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

const jour = (d: Date) => d.toISOString().split("T")[0];

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

  // ── 2. Séries & encaissements (crédits + ventes + packs) ─────────────────
  // On ne se centre PLUS sur les packs : la courbe met en avant les crédits
  // remboursés et les ventes directes (activité principale).

  const [remboursements, ventes, versementsPacks] = await Promise.all([
    prisma.remboursementCredit.findMany({
      where: { dateRemboursement: { gte: prevSince } },
      select: { dateRemboursement: true, montant: true },
    }),
    prisma.venteDirecte.findMany({
      where: { createdAt: { gte: prevSince }, statut: { notIn: [...VENTE_EXCLUES] } },
      select: { createdAt: true, montantTotal: true, montantPaye: true, monnaieRendue: true },
    }),
    prisma.versementPack.findMany({
      where: { datePaiement: { gte: prevSince } },
      select: { datePaiement: true, montant: true },
    }),
  ]);

  // Maps journalières (période courante) — série 1 = crédits, série 2 = ventes.
  const rembMap: Record<string, number> = {};
  const ventesMap: Record<string, number> = {};
  // Cumuls encaissements (cash net) période courante vs précédente.
  let encCurr = 0, encPrev = 0, nbCurr = 0;

  const inCurr = (d: Date) => d >= since;

  for (const r of remboursements) {
    const m = Number(r.montant);
    if (inCurr(r.dateRemboursement)) {
      rembMap[jour(r.dateRemboursement)] = (rembMap[jour(r.dateRemboursement)] ?? 0) + m;
      encCurr += m; nbCurr += 1;
    } else { encPrev += m; }
  }
  for (const v of ventes) {
    const total = Number(v.montantTotal);
    const cashNet = Math.max(0, Number(v.montantPaye) - Number(v.monnaieRendue));
    if (inCurr(v.createdAt)) {
      ventesMap[jour(v.createdAt)] = (ventesMap[jour(v.createdAt)] ?? 0) + total;
      encCurr += cashNet; nbCurr += 1;
    } else { encPrev += cashNet; }
  }
  for (const p of versementsPacks) {
    const m = Number(p.montant);
    if (inCurr(p.datePaiement)) { encCurr += m; nbCurr += 1; }
    else { encPrev += m; }
  }

  // Tableaux jour par jour (série 1 : crédits remboursés · série 2 : ventes directes)
  const evolutionVersements: { date: string; montant: number }[] = [];
  const evolutionSouscriptions: { date: string; montant: number }[] = [];
  for (let i = period; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const k = jour(d);
    evolutionVersements.push({ date: k, montant: rembMap[k] ?? 0 });
    evolutionSouscriptions.push({ date: k, montant: ventesMap[k] ?? 0 });
  }

  // ── 3. Répartition des souscriptions par statut ──────────────────────────

  const [souscActives, souscCompletes, souscAnnulees] = await Promise.all([
    prisma.souscriptionPack.count({ where: { statut: "ACTIF" } }),
    prisma.souscriptionPack.count({ where: { statut: "COMPLETE" } }),
    prisma.souscriptionPack.count({ where: { statut: "ANNULE" } }),
  ]);

  // ── 4. Comparaisons période actuelle vs précédente ───────────────────────

  const [nouvMembresCurr, nouvMembresPrec, souscCurr, souscPrec] = await Promise.all([
    prisma.client.count({ where: { createdAt: { gte: since } } }),
    prisma.client.count({ where: { createdAt: { gte: prevSince, lt: since } } }),
    prisma.souscriptionPack.count({ where: { createdAt: { gte: since } } }),
    prisma.souscriptionPack.count({ where: { createdAt: { gte: prevSince, lt: since } } }),
  ]);

  // ── 5. Retour ────────────────────────────────────────────────────────────

  return {
    clientsActifs,
    souscriptionsActives,
    packsTotal,
    // Encaissements réels de la période (crédits remboursés + ventes cash + packs)
    versementsTotal: { count: nbCurr, montant: Math.round(encCurr) },
    evolutionVersements,   // série 1 : crédits remboursés / jour
    evolutionSouscriptions, // série 2 : ventes directes / jour
    repartitionSouscriptions: {
      actives:   souscActives,
      completes: souscCompletes,
      annulees:  souscAnnulees,
    },
    comparaisons: {
      clients:    { pct: pctChange(nouvMembresCurr, nouvMembresPrec), positif: isPositiveChange(nouvMembresCurr, nouvMembresPrec) },
      versements: { pct: pctChange(encCurr, encPrev),                 positif: isPositiveChange(encCurr, encPrev) },
      packs:      { pct: pctChange(souscCurr, souscPrec),             positif: isPositiveChange(souscCurr, souscPrec) },
    },
  };
}
