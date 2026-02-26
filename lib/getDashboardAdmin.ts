import { prisma } from "@/lib/prisma";
import { MemberStatus } from "@prisma/client";

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
