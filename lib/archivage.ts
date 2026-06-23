import { Prisma, StatutCredit, StatutEcheanceCredit } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Archivage intelligent — classeurs numériques générés automatiquement à partir
 * des dates (Année → Mois → Semaine → Jour). Quatre rubriques par niveau :
 *  - Collectes : remboursements de crédit CONFIRME
 *  - Retards   : échéances échues impayées (crédit encore en cours)
 *  - Impayés   : crédits clos (date de fin dépassée) avec solde restant
 *  - Rapports  : synthèse KPIs calculée à partir des trois ci-dessus
 *
 * `creditWhere` = périmètre des crédits (CreditClientWhereInput) selon le rôle.
 */

const MOIS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

/** Numéro de semaine ISO (1..53). */
export function semaineISO(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // lundi = 0
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // jeudi de la semaine
  const premierJeudi = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const pjDay = (premierJeudi.getUTCDay() + 6) % 7;
  premierJeudi.setUTCDate(premierJeudi.getUTCDate() - pjDay + 3);
  return 1 + Math.round((date.getTime() - premierJeudi.getTime()) / (7 * 86400000));
}

export interface Agg {
  nbCollectes: number; montantCollecte: number;
  nbRetards: number;   montantRetards: number;
  nbImpayes: number;   montantImpayes: number;
}
const agg0 = (): Agg => ({ nbCollectes: 0, montantCollecte: 0, nbRetards: 0, montantRetards: 0, nbImpayes: 0, montantImpayes: 0 });
function cumuler(into: Agg, from: Agg) {
  into.nbCollectes += from.nbCollectes; into.montantCollecte += from.montantCollecte;
  into.nbRetards += from.nbRetards;     into.montantRetards += from.montantRetards;
  into.nbImpayes += from.nbImpayes;     into.montantImpayes += from.montantImpayes;
}

export interface Rapport {
  totalCollecte: number;
  nbRetards: number; montantRetards: number;
  nbImpayes: number; montantImpayes: number;
  tauxRecouvrement: number; // % collecté / (collecté + impayés)
}
export function genererRapport(a: Agg): Rapport {
  const base = a.montantCollecte + a.montantImpayes;
  return {
    totalCollecte:    a.montantCollecte,
    nbRetards:        a.nbRetards,
    montantRetards:   a.montantRetards,
    nbImpayes:        a.nbImpayes,
    montantImpayes:   a.montantImpayes,
    tauxRecouvrement: base > 0 ? Math.round((a.montantCollecte / base) * 100) : 100,
  };
}

export interface NoeudJour    { date: string; label: string; agg: Agg; rapport: Rapport }
export interface NoeudSemaine { semaine: number; label: string; agg: Agg; rapport: Rapport; jours: NoeudJour[] }
export interface NoeudMois    { mois: number; label: string; agg: Agg; rapport: Rapport; semaines: NoeudSemaine[] }
export interface ArbreAnnee   { annee: number; agg: Agg; rapport: Rapport; mois: NoeudMois[]; anneesDisponibles: number[] }

const cleJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const labelJour = (d: Date) => `${d.getDate()} ${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`;

/** Charge l'arbre d'une année (mois → semaines → jours) avec agrégats. */
export async function chargerArchiveAnnee(creditWhere: Prisma.CreditClientWhereInput, annee: number): Promise<ArbreAnnee> {
  const debut = new Date(annee, 0, 1);
  const fin   = new Date(annee + 1, 0, 1);
  const now   = new Date();

  const [remboursements, echeances, credits, premierRemb] = await Promise.all([
    prisma.remboursementCredit.findMany({
      where: { statut: "CONFIRME", dateRemboursement: { gte: debut, lt: fin }, credit: creditWhere },
      select: { dateRemboursement: true, montant: true },
    }),
    prisma.echeanceCredit.findMany({
      where: {
        statut: { not: StatutEcheanceCredit.PAYE },
        dateEcheance: { gte: debut, lt: fin },
        credit: { ...creditWhere, statut: { in: [StatutCredit.ACTIF, StatutCredit.EN_RETARD] } },
      },
      select: { dateEcheance: true, montantDu: true, montantPaye: true },
    }),
    prisma.creditClient.findMany({
      where: {
        ...creditWhere,
        dateEcheanceFin: { gte: debut, lt: fin },
        soldeRestant: { gt: 0 },
        statut: { notIn: [StatutCredit.SOLDE, StatutCredit.ANNULE, StatutCredit.REJETE] },
      },
      select: { dateEcheanceFin: true, soldeRestant: true },
    }),
    prisma.remboursementCredit.findFirst({
      where: { statut: "CONFIRME", credit: creditWhere },
      orderBy: { dateRemboursement: "asc" },
      select: { dateRemboursement: true },
    }),
  ]);

  // Bucketing imbriqué : mois → semaine → jour
  const moisMap = new Map<number, Map<number, Map<string, { date: Date; agg: Agg }>>>();
  const bucket = (d: Date, apply: (a: Agg) => void) => {
    const m = d.getMonth() + 1;
    const w = semaineISO(d);
    const k = cleJour(d);
    if (!moisMap.has(m)) moisMap.set(m, new Map());
    const sem = moisMap.get(m)!;
    if (!sem.has(w)) sem.set(w, new Map());
    const jrs = sem.get(w)!;
    if (!jrs.has(k)) jrs.set(k, { date: d, agg: agg0() });
    apply(jrs.get(k)!.agg);
  };

  for (const r of remboursements) {
    bucket(new Date(r.dateRemboursement), (a) => { a.nbCollectes += 1; a.montantCollecte += Number(r.montant); });
  }
  for (const e of echeances) {
    if (new Date(e.dateEcheance) >= now) continue; // retard = échue uniquement
    const reste = Math.max(0, Number(e.montantDu) - Number(e.montantPaye));
    bucket(new Date(e.dateEcheance), (a) => { a.nbRetards += 1; a.montantRetards += reste; });
  }
  for (const c of credits) {
    if (!c.dateEcheanceFin || new Date(c.dateEcheanceFin) >= now) continue; // crédit clos uniquement
    bucket(new Date(c.dateEcheanceFin), (a) => { a.nbImpayes += 1; a.montantImpayes += Number(c.soldeRestant); });
  }

  // Construction de l'arbre trié
  const aggAnnee = agg0();
  const mois: NoeudMois[] = [...moisMap.entries()].sort((a, b) => a[0] - b[0]).map(([m, semMap]) => {
    const aggMois = agg0();
    const semaines: NoeudSemaine[] = [...semMap.entries()].sort((a, b) => a[0] - b[0]).map(([w, jrsMap]) => {
      const aggSem = agg0();
      const jours: NoeudJour[] = [...jrsMap.values()].sort((a, b) => a.date.getTime() - b.date.getTime()).map((j) => {
        cumuler(aggSem, j.agg);
        return { date: cleJour(j.date), label: labelJour(j.date), agg: j.agg, rapport: genererRapport(j.agg) };
      });
      cumuler(aggMois, aggSem);
      return { semaine: w, label: `Semaine ${w}`, agg: aggSem, rapport: genererRapport(aggSem), jours };
    });
    cumuler(aggAnnee, aggMois);
    return { mois: m, label: MOIS_FR[m - 1], agg: aggMois, rapport: genererRapport(aggMois), semaines };
  });

  const anneeMin = premierRemb?.dateRemboursement ? new Date(premierRemb.dateRemboursement).getFullYear() : annee;
  const anneeMax = Math.max(annee, now.getFullYear());
  const anneesDisponibles: number[] = [];
  for (let y = Math.min(anneeMin, annee); y <= anneeMax; y++) anneesDisponibles.push(y);

  return { annee, agg: aggAnnee, rapport: genererRapport(aggAnnee), mois, anneesDisponibles };
}

// ── Détail d'une journée ────────────────────────────────────────────────────────
export interface ItemCollecte { id: number; client: string; reference: string; montant: number; numeroJour: number | null; agent: string | null; heure: string }
export interface ItemRetard   { client: string; reference: string; numeroEcheance: number; dateEcheance: string; reste: number; joursRetard: number }
export interface ItemImpaye   { client: string; reference: string; soldeRestant: number; dateEcheanceFin: string }
export interface DetailJour { date: string; label: string; collectes: ItemCollecte[]; retards: ItemRetard[]; impayes: ItemImpaye[]; rapport: Rapport }

// ── Détail ligne par ligne sur une plage [debut, fin) ──────────────────────────
// Chaque item est étiqueté de son jour (clé YYYY-MM-DD) pour regroupement export.
export interface ItemCollectePlage extends ItemCollecte { jour: string }
export interface ItemRetardPlage   extends ItemRetard   { jour: string }
export interface ItemImpayePlage   extends ItemImpaye   { jour: string }
export interface DetailPlage { collectes: ItemCollectePlage[]; retards: ItemRetardPlage[]; impayes: ItemImpayePlage[] }

export async function chargerArchivePlage(creditWhere: Prisma.CreditClientWhereInput, debut: Date, fin: Date): Promise<DetailPlage> {
  const now = new Date();
  const [remboursements, echeances, credits] = await Promise.all([
    prisma.remboursementCredit.findMany({
      where: { statut: "CONFIRME", dateRemboursement: { gte: debut, lt: fin }, credit: creditWhere },
      orderBy: { dateRemboursement: "asc" },
      select: {
        id: true, montant: true, numeroJour: true, dateRemboursement: true,
        agentCollecteur: { select: { nom: true, prenom: true } },
        credit: { select: { reference: true, client: { select: { nom: true, prenom: true } } } },
      },
    }),
    prisma.echeanceCredit.findMany({
      where: {
        statut: { not: StatutEcheanceCredit.PAYE },
        dateEcheance: { gte: debut, lt: fin },
        credit: { ...creditWhere, statut: { in: [StatutCredit.ACTIF, StatutCredit.EN_RETARD] } },
      },
      orderBy: { dateEcheance: "asc" },
      select: {
        numeroEcheance: true, dateEcheance: true, montantDu: true, montantPaye: true,
        credit: { select: { reference: true, client: { select: { nom: true, prenom: true } } } },
      },
    }),
    prisma.creditClient.findMany({
      where: {
        ...creditWhere,
        dateEcheanceFin: { gte: debut, lt: fin },
        soldeRestant: { gt: 0 },
        statut: { notIn: [StatutCredit.SOLDE, StatutCredit.ANNULE, StatutCredit.REJETE] },
      },
      select: { reference: true, soldeRestant: true, dateEcheanceFin: true, client: { select: { nom: true, prenom: true } } },
    }),
  ]);

  const collectes: ItemCollectePlage[] = remboursements.map((r) => ({
    jour: cleJour(new Date(r.dateRemboursement)),
    id: r.id,
    client: `${r.credit.client.prenom} ${r.credit.client.nom}`,
    reference: r.credit.reference,
    montant: Number(r.montant),
    numeroJour: r.numeroJour,
    agent: r.agentCollecteur ? `${r.agentCollecteur.prenom} ${r.agentCollecteur.nom}` : null,
    heure: new Date(r.dateRemboursement).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
  }));
  const retards: ItemRetardPlage[] = echeances
    .filter((e) => new Date(e.dateEcheance) < now)
    .map((e) => ({
      jour: cleJour(new Date(e.dateEcheance)),
      client: `${e.credit.client.prenom} ${e.credit.client.nom}`,
      reference: e.credit.reference,
      numeroEcheance: e.numeroEcheance,
      dateEcheance: new Date(e.dateEcheance).toISOString(),
      reste: Math.max(0, Number(e.montantDu) - Number(e.montantPaye)),
      joursRetard: Math.max(0, Math.floor((now.getTime() - new Date(e.dateEcheance).getTime()) / 86400000)),
    }));
  const impayes: ItemImpayePlage[] = credits
    .filter((c) => c.dateEcheanceFin && new Date(c.dateEcheanceFin) < now)
    .map((c) => ({
      jour: cleJour(new Date(c.dateEcheanceFin!)),
      client: `${c.client.prenom} ${c.client.nom}`,
      reference: c.reference,
      soldeRestant: Number(c.soldeRestant),
      dateEcheanceFin: new Date(c.dateEcheanceFin!).toISOString(),
    }));

  return { collectes, retards, impayes };
}

export async function chargerArchiveJour(creditWhere: Prisma.CreditClientWhereInput, dateStr: string): Promise<DetailJour> {
  const jour = new Date(dateStr);
  const debut = new Date(jour.getFullYear(), jour.getMonth(), jour.getDate());
  const fin   = new Date(jour.getFullYear(), jour.getMonth(), jour.getDate() + 1);
  const now   = new Date();

  const [remboursements, echeances, credits] = await Promise.all([
    prisma.remboursementCredit.findMany({
      where: { statut: "CONFIRME", dateRemboursement: { gte: debut, lt: fin }, credit: creditWhere },
      orderBy: { dateRemboursement: "asc" },
      select: {
        id: true, montant: true, numeroJour: true, dateRemboursement: true,
        agentCollecteur: { select: { nom: true, prenom: true } },
        credit: { select: { reference: true, client: { select: { nom: true, prenom: true } } } },
      },
    }),
    prisma.echeanceCredit.findMany({
      where: {
        statut: { not: StatutEcheanceCredit.PAYE },
        dateEcheance: { gte: debut, lt: fin },
        credit: { ...creditWhere, statut: { in: [StatutCredit.ACTIF, StatutCredit.EN_RETARD] } },
      },
      orderBy: { dateEcheance: "asc" },
      select: {
        numeroEcheance: true, dateEcheance: true, montantDu: true, montantPaye: true,
        credit: { select: { reference: true, client: { select: { nom: true, prenom: true } } } },
      },
    }),
    prisma.creditClient.findMany({
      where: {
        ...creditWhere,
        dateEcheanceFin: { gte: debut, lt: fin },
        soldeRestant: { gt: 0 },
        statut: { notIn: [StatutCredit.SOLDE, StatutCredit.ANNULE, StatutCredit.REJETE] },
      },
      select: { reference: true, soldeRestant: true, dateEcheanceFin: true, client: { select: { nom: true, prenom: true } } },
    }),
  ]);

  const agg = agg0();
  const collectes: ItemCollecte[] = remboursements.map((r) => {
    agg.nbCollectes += 1; agg.montantCollecte += Number(r.montant);
    return {
      id: r.id,
      client: `${r.credit.client.prenom} ${r.credit.client.nom}`,
      reference: r.credit.reference,
      montant: Number(r.montant),
      numeroJour: r.numeroJour,
      agent: r.agentCollecteur ? `${r.agentCollecteur.prenom} ${r.agentCollecteur.nom}` : null,
      heure: new Date(r.dateRemboursement).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    };
  });
  const retards: ItemRetard[] = echeances
    .filter((e) => new Date(e.dateEcheance) < now)
    .map((e) => {
      const reste = Math.max(0, Number(e.montantDu) - Number(e.montantPaye));
      agg.nbRetards += 1; agg.montantRetards += reste;
      return {
        client: `${e.credit.client.prenom} ${e.credit.client.nom}`,
        reference: e.credit.reference,
        numeroEcheance: e.numeroEcheance,
        dateEcheance: new Date(e.dateEcheance).toISOString(),
        reste,
        joursRetard: Math.max(0, Math.floor((now.getTime() - new Date(e.dateEcheance).getTime()) / 86400000)),
      };
    });
  const impayes: ItemImpaye[] = credits
    .filter((c) => c.dateEcheanceFin && new Date(c.dateEcheanceFin) < now)
    .map((c) => {
      agg.nbImpayes += 1; agg.montantImpayes += Number(c.soldeRestant);
      return {
        client: `${c.client.prenom} ${c.client.nom}`,
        reference: c.reference,
        soldeRestant: Number(c.soldeRestant),
        dateEcheanceFin: new Date(c.dateEcheanceFin!).toISOString(),
      };
    });

  return { date: dateStr, label: labelJour(jour), collectes, retards, impayes, rapport: genererRapport(agg) };
}
