import { prisma } from "@/lib/prisma";
import { MemberStatus, StatutTontine, StatutCredit, StatutCotisation } from "@prisma/client";

// ─── Helper ──────────────────────────────────────────────────────────────────

function pctChange(curr: number, prev: number): string {
  if (prev === 0 && curr === 0) return "=";
  if (prev === 0) return "+100%";
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

  const [
    membresActifs,
    tontinesActives,
    creditsEnCours,
  ] = await Promise.all([
    prisma.user.count({ where: { etat: MemberStatus.ACTIF } }),
    prisma.tontine.count({ where: { statut: StatutTontine.ACTIVE } }),
    prisma.credit.count({
      where: {
        statut: { in: [StatutCredit.EN_ATTENTE, StatutCredit.APPROUVE, StatutCredit.REMBOURSE_PARTIEL] },
      },
    }),
  ]);

  // ── 2. Montant total achats (quantite × prixUnitaire) ────────────────────
  // Prisma ne supporte pas les colonnes calculées en aggregate → on utilise $queryRaw
  const [achatsTotal] = await prisma.$queryRaw<{ total: string }[]>`
    SELECT COALESCE(SUM(quantite * "prixUnitaire"), 0)::text AS total
    FROM "VenteCreditAlimentaire"
  `;
  const [nombreAchats] = await prisma.$queryRaw<{ cnt: string }[]>`
    SELECT COUNT(*)::text AS cnt FROM "VenteCreditAlimentaire"
  `;

  // ── 3. Évolution des ventes (par jour sur la période) ───────────────────
  const ventesRecentes = await prisma.venteCreditAlimentaire.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, quantite: true, prixUnitaire: true },
    orderBy: { createdAt: "asc" },
  });

  const ventesMap: Record<string, number> = {};
  for (const v of ventesRecentes) {
    const k = v.createdAt.toISOString().split("T")[0];
    ventesMap[k] = (ventesMap[k] ?? 0) + v.quantite * Number(v.prixUnitaire);
  }

  // ── 4. Évolution des cotisations payées (par jour) ───────────────────────
  const cotisationsRecentes = await prisma.cotisation.findMany({
    where: {
      statut: StatutCotisation.PAYEE,
      datePaiement: { gte: since },
    },
    select: { datePaiement: true, montant: true },
    orderBy: { datePaiement: "asc" },
  });

  const cotisMap: Record<string, number> = {};
  for (const c of cotisationsRecentes) {
    if (!c.datePaiement) continue;
    const k = c.datePaiement.toISOString().split("T")[0];
    cotisMap[k] = (cotisMap[k] ?? 0) + Number(c.montant);
  }

  // Tableau jour par jour (un point par jour du plus ancien au plus récent)
  const evolutionVentes: { date: string; montant: number }[] = [];
  const evolutionCotisations: { date: string; montant: number }[] = [];
  for (let i = period; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const k = d.toISOString().split("T")[0];
    evolutionVentes.push({ date: k, montant: ventesMap[k] ?? 0 });
    evolutionCotisations.push({ date: k, montant: cotisMap[k] ?? 0 });
  }

  // ── 5. Répartition des cotisations par statut ────────────────────────────
  const [nbEnAttente, nbPayees, nbExpirees] = await Promise.all([
    prisma.cotisation.count({ where: { statut: StatutCotisation.EN_ATTENTE } }),
    prisma.cotisation.count({ where: { statut: StatutCotisation.PAYEE } }),
    prisma.cotisation.count({ where: { statut: StatutCotisation.EXPIREE } }),
  ]);

  // ── 6. Comparaisons période actuelle vs précédente (pour badges %) ────────
  const [
    nouvMembresCurr,
    nouvMembresPrec,
    nouvCotisCurr,
    nouvCotisPrec,
  ] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.user.count({ where: { createdAt: { gte: prevSince, lt: since } } }),
    prisma.cotisation.count({ where: { statut: StatutCotisation.PAYEE, datePaiement: { gte: since } } }),
    prisma.cotisation.count({ where: { statut: StatutCotisation.PAYEE, datePaiement: { gte: prevSince, lt: since } } }),
  ]);

  const ventesCurr = ventesRecentes.reduce((acc, v) => acc + v.quantite * Number(v.prixUnitaire), 0);

  const ventesPrec = await prisma.venteCreditAlimentaire.findMany({
    where: { createdAt: { gte: prevSince, lt: since } },
    select: { quantite: true, prixUnitaire: true },
  });
  const ventesPrecTotal = ventesPrec.reduce((acc, v) => acc + v.quantite * Number(v.prixUnitaire), 0);

  // ── 7. Retour ────────────────────────────────────────────────────────────
  return {
    // Compteurs
    membresActifs,
    tontinesActives,
    creditsEnCours,
    achatsCreditAlimentaire: {
      nombreAchats: Number(nombreAchats.cnt),
      montantTotal: Number(achatsTotal.total),
    },

    // Charts
    evolutionVentes,
    evolutionCotisations,
    repartitionCotisations: {
      enAttente: nbEnAttente,
      payees: nbPayees,
      expirees: nbExpirees,
    },

    // % comparaisons (pour les badges sur les stats cards)
    comparaisons: {
      membres:    { pct: pctChange(nouvMembresCurr, nouvMembresPrec),  positif: isPositiveChange(nouvMembresCurr, nouvMembresPrec) },
      cotisations:{ pct: pctChange(nouvCotisCurr,   nouvCotisPrec),    positif: isPositiveChange(nouvCotisCurr,   nouvCotisPrec)  },
      ventes:     { pct: pctChange(ventesCurr,       ventesPrecTotal),  positif: isPositiveChange(ventesCurr,       ventesPrecTotal) },
      credits:    { pct: "—", positif: true }, // snapshot, pas de comparaison pertinente
    },
  };
}
