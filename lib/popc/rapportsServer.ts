// lib/popc/rapportsServer.ts
// §13 — Génération des rapports POPC (structure indépendante du format).
// La même structure alimente le PDF (serveur) et l'Excel (client). Réutilise les
// calculateurs existants (réalisations, consolidation, tableau commercial, plan).

import { prisma } from "@/lib/prisma";
import {
  calculerSuiviJournalier, calculerConsolidationDirection, calculerTableauCommercial,
} from "@/lib/popc/realisationsServer";
import { planifierLivraisons } from "@/lib/popc/livraisonsServer";
import { estEcheanceRemuneration } from "@/lib/formuleCredit";

export type TypeRapport =
  | "journalier" | "hebdomadaire" | "quinzaine" | "trentaine" | "mensuel" | "annuel"
  | "comparatif" | "rentabilite-agence" | "rentabilite-commercial" | "rentabilite-superviseur"
  | "prevision-collectes" | "prevision-clients";

export type ColonneType = "text" | "number" | "currency" | "date";
export interface ColonneRapport { label: string; type?: ColonneType }

export interface RapportPOPC {
  code: TypeRapport;
  titre: string;
  periode: string;
  genereLe: string;
  resume: { label: string; valeur: string }[];
  colonnes: ColonneRapport[];
  lignes: (string | number)[][];
  totaux?: (string | number)[];
}

export interface ParamsRapport { annee: number; mois: number; date?: string; pdv?: number }

const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const fmt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v));
const frDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR");

/** Liste de N jours (YYYY-MM-DD) se terminant à `dateFin` inclus. */
function joursGlissants(dateFin: string, n: number): string[] {
  const out: string[] = [];
  const base = new Date(dateFin);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base); d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Rapport « période journalière » (hebdo / quinzaine / trentaine). */
async function rapportPeriode(
  code: TypeRapport, titre: string, dateFin: string, nbJours: number, pdv: number,
): Promise<RapportPOPC> {
  const jours = joursGlissants(dateFin, nbJours);
  const colonnes: ColonneRapport[] = [
    { label: "Date", type: "text" },
    { label: "Clients livrés", type: "number" }, { label: "Clients collectés", type: "number" },
    { label: "16èmes", type: "number" }, { label: "31èmes", type: "number" },
    { label: "Carnets", type: "number" },
    { label: "Montant collecté", type: "currency" }, { label: "Revenu généré", type: "currency" },
  ];
  const lignes: (string | number)[][] = [];
  const T = { livres: 0, collectes: 0, s16: 0, s31: 0, carnets: 0, montant: 0, revenu: 0 };
  for (const j of jours) {
    const s = await calculerSuiviJournalier(j, pdv);
    const r = s.realisations;
    lignes.push([frDate(j), r.clientsLivres, r.clientsCollectes, r.nb16Real, r.nb31Real, r.carnetsVendus, r.montantCollecte, r.revenuGenere]);
    T.livres += r.clientsLivres; T.collectes += r.clientsCollectes; T.s16 += r.nb16Real;
    T.s31 += r.nb31Real; T.carnets += r.carnetsVendus; T.montant += r.montantCollecte; T.revenu += r.revenuGenere;
  }
  return {
    code, titre, periode: `${frDate(jours[0])} → ${frDate(jours[jours.length - 1])}`,
    genereLe: new Date().toISOString(),
    resume: [
      { label: "Montant collecté", valeur: `${fmt(T.montant)} FCFA` },
      { label: "Revenu généré", valeur: `${fmt(T.revenu)} FCFA` },
      { label: "16èmes / 31èmes", valeur: `${T.s16} / ${T.s31}` },
    ],
    colonnes, lignes,
    totaux: ["Total", T.livres, T.collectes, T.s16, T.s31, T.carnets, Number(T.montant.toFixed(2)), Number(T.revenu.toFixed(2))],
  };
}

/** Rapport journalier (§8). */
async function rapportJournalier(date: string, pdv: number): Promise<RapportPOPC> {
  const s = await calculerSuiviJournalier(date, pdv);
  return {
    code: "journalier", titre: "Rapport journalier", periode: frDate(date),
    genereLe: new Date().toISOString(),
    resume: [{ label: "Taux de réalisation", valeur: `${s.tauxRealisation}%` }],
    colonnes: [
      { label: "Indicateur", type: "text" }, { label: "Objectif", type: "number" },
      { label: "Réalisé", type: "number" }, { label: "Reste", type: "number" },
    ],
    lignes: s.indicateurs.map((i) => [i.indicateur, i.objectif, i.realise, i.reste]),
  };
}

/** Rapport mensuel / consolidation Direction (§11). */
async function rapportMensuel(annee: number, mois: number, pdv: number): Promise<RapportPOPC> {
  const c = await calculerConsolidationDirection(annee, mois, pdv);
  const lignes: (string | number)[][] = [
    ["Charges mensuelles", fmt(c.chargesTotales)],
    ["Revenu minimum à générer", fmt(c.revenuMinimum)],
    ["Revenus attendus", fmt(c.revenusAttendus)],
    ["Revenus encaissés", fmt(c.revenusEncaisses)],
    ["Charges couvertes", `${c.chargesCouvertes}%`],
    ["Résultat prévisionnel", fmt(c.resultatPrevisionnel)],
    ["Bénéfice estimé", fmt(c.beneficeEstime)],
    ["Clients actifs", fmt(c.clientsActifs)],
    ["Nouveaux crédits", fmt(c.nouveauxCredits)],
    ["16èmes attendus", fmt(c.seiziemesAttendus)],
    ["31èmes attendus", fmt(c.trentiemesAttendus)],
    ["Carnets vendus", fmt(c.carnetsVendus)],
    ["Objectif atteint", c.objectifAtteint ? "Oui" : "Non"],
  ];
  return {
    code: "mensuel", titre: "Rapport mensuel", periode: `${MOIS[mois - 1]} ${annee}`,
    genereLe: new Date().toISOString(),
    resume: [{ label: "Bénéfice estimé", valeur: `${fmt(c.beneficeEstime)} FCFA` }],
    colonnes: [{ label: "Indicateur", type: "text" }, { label: "Valeur", type: "text" }],
    lignes,
  };
}

/** Rapport annuel : 12 mois consolidés. */
async function rapportAnnuel(annee: number, pdv: number): Promise<RapportPOPC> {
  const colonnes: ColonneRapport[] = [
    { label: "Mois", type: "text" }, { label: "Charges", type: "currency" },
    { label: "Revenus attendus", type: "currency" }, { label: "Revenus encaissés", type: "currency" },
    { label: "Bénéfice estimé", type: "currency" }, { label: "16es", type: "number" }, { label: "31es", type: "number" },
    { label: "Crédits", type: "number" }, { label: "Carnets", type: "number" },
  ];
  const lignes: (string | number)[][] = [];
  const T = { ch: 0, ra: 0, re: 0, be: 0, s16: 0, s31: 0, cr: 0, ca: 0 };
  for (let m = 1; m <= 12; m++) {
    const c = await calculerConsolidationDirection(annee, m, pdv);
    lignes.push([MOIS[m - 1], c.chargesTotales, c.revenusAttendus, c.revenusEncaisses, c.beneficeEstime, c.seiziemesAttendus, c.trentiemesAttendus, c.nouveauxCredits, c.carnetsVendus]);
    T.ch += c.chargesTotales; T.ra += c.revenusAttendus; T.re += c.revenusEncaisses; T.be += c.beneficeEstime;
    T.s16 += c.seiziemesAttendus; T.s31 += c.trentiemesAttendus; T.cr += c.nouveauxCredits; T.ca += c.carnetsVendus;
  }
  return {
    code: "annuel", titre: "Rapport annuel", periode: `Année ${annee}`,
    genereLe: new Date().toISOString(),
    resume: [
      { label: "Revenus encaissés", valeur: `${fmt(T.re)} FCFA` },
      { label: "Bénéfice estimé", valeur: `${fmt(T.be)} FCFA` },
    ],
    colonnes, lignes,
    totaux: ["Total", Number(T.ch.toFixed(2)), Number(T.ra.toFixed(2)), Number(T.re.toFixed(2)), Number(T.be.toFixed(2)), T.s16, T.s31, T.cr, T.ca],
  };
}

/** Comparatif Objectif / Réalisé (mois). */
async function rapportComparatif(annee: number, mois: number, pdv: number): Promise<RapportPOPC> {
  const param = await prisma.parametragePOPC.findUnique({
    where: { annee_mois_pointDeVenteId: { annee, mois, pointDeVenteId: pdv } },
    include: { objectif: true },
  });
  const o = param?.objectif;
  const c = await calculerConsolidationDirection(annee, mois, pdv);
  const ligne = (lib: string, obj: number, real: number): (string | number)[] => {
    const ecart = Number((real - obj).toFixed(2));
    const taux = obj > 0 ? `${Math.round((real / obj) * 100)}%` : "—";
    return [lib, fmt(obj), fmt(real), fmt(ecart), taux];
  };
  const lignes: (string | number)[][] = o ? [
    ligne("Revenu (FCFA)", Number(o.revenuMinimum), c.revenusEncaisses),
    ligne("16èmes", o.nbSeiziemes, c.seiziemesAttendus),
    ligne("31èmes", o.nbTrentiemes, c.trentiemesAttendus),
    ligne("Nouveaux crédits", o.nbNouveauxCredits, c.nouveauxCredits),
    ligne("Carnets", o.nbCarnets, c.carnetsVendus),
  ] : [];
  return {
    code: "comparatif", titre: "Comparatif Objectif / Réalisé", periode: `${MOIS[mois - 1]} ${annee}`,
    genereLe: new Date().toISOString(),
    resume: [{ label: "Objectif atteint", valeur: c.objectifAtteint ? "Oui" : "Non" }],
    colonnes: [
      { label: "Indicateur", type: "text" }, { label: "Objectif", type: "text" },
      { label: "Réalisé", type: "text" }, { label: "Écart", type: "text" }, { label: "Taux", type: "text" },
    ],
    lignes,
  };
}

/** Rentabilité par agence (par PDV). */
async function rapportRentabiliteAgence(annee: number, mois: number): Promise<RapportPOPC> {
  const pdvs = await prisma.pointDeVente.findMany({ select: { id: true, nom: true } });
  const colonnes: ColonneRapport[] = [
    { label: "Agence", type: "text" }, { label: "Revenus encaissés", type: "currency" },
    { label: "Revenus attendus", type: "currency" }, { label: "Charges", type: "currency" },
    { label: "Bénéfice estimé", type: "currency" }, { label: "Clients actifs", type: "number" },
  ];
  const lignes: (string | number)[][] = [];
  for (const p of pdvs) {
    const c = await calculerConsolidationDirection(annee, mois, p.id);
    lignes.push([p.nom, c.revenusEncaisses, c.revenusAttendus, c.chargesTotales, c.beneficeEstime, c.clientsActifs]);
  }
  return {
    code: "rentabilite-agence", titre: "Rentabilité par agence", periode: `${MOIS[mois - 1]} ${annee}`,
    genereLe: new Date().toISOString(), resume: [], colonnes, lignes,
  };
}

/** Rentabilité par commercial (par agent terrain). */
async function rapportRentabiliteCommercial(annee: number, mois: number): Promise<RapportPOPC> {
  const agents = await prisma.user.findMany({
    where: { gestionnaire: { role: "AGENT_TERRAIN", actif: true } },
    select: { id: true, nom: true, prenom: true },
  });
  const colonnes: ColonneRapport[] = [
    { label: "Commercial", type: "text" }, { label: "Clients affectés", type: "number" },
    { label: "Crédits livrés", type: "number" }, { label: "16es", type: "number" }, { label: "31es", type: "number" },
    { label: "Carnets", type: "number" }, { label: "Montant collecté", type: "currency" }, { label: "Taux", type: "text" },
  ];
  const lignes: (string | number)[][] = [];
  for (const a of agents) {
    const t = await calculerTableauCommercial(a.id, annee, mois);
    lignes.push([`${a.prenom} ${a.nom}`, t.clientsAffectes, t.creditsLivres, t.seiziemesCollectes, t.trentiemesCollectes, t.carnetsVendus, t.montantCollecte, `${t.tauxRealisation}%`]);
  }
  return {
    code: "rentabilite-commercial", titre: "Rentabilité par commercial", periode: `${MOIS[mois - 1]} ${annee}`,
    genereLe: new Date().toISOString(), resume: [], colonnes, lignes,
  };
}

/** Rentabilité par superviseur (contrôleur terrain, agrégé sur son agence). */
async function rapportRentabiliteSuperviseur(annee: number, mois: number): Promise<RapportPOPC> {
  const superviseurs = await prisma.user.findMany({
    where: { gestionnaire: { role: "CONTROLEUR_TERRAIN", actif: true } },
    select: {
      id: true, nom: true, prenom: true,
      affectationsPDV: { where: { actif: true }, select: { pointDeVenteId: true, pointDeVente: { select: { nom: true } } }, take: 1 },
    },
  });
  const colonnes: ColonneRapport[] = [
    { label: "Superviseur", type: "text" }, { label: "Agence", type: "text" },
    { label: "Revenus encaissés", type: "currency" }, { label: "Bénéfice estimé", type: "currency" },
    { label: "Clients actifs", type: "number" },
  ];
  const lignes: (string | number)[][] = [];
  for (const s of superviseurs) {
    const aff = s.affectationsPDV[0];
    if (!aff) { lignes.push([`${s.prenom} ${s.nom}`, "—", 0, 0, 0]); continue; }
    const c = await calculerConsolidationDirection(annee, mois, aff.pointDeVenteId);
    lignes.push([`${s.prenom} ${s.nom}`, aff.pointDeVente?.nom ?? "—", c.revenusEncaisses, c.beneficeEstime, c.clientsActifs]);
  }
  return {
    code: "rentabilite-superviseur", titre: "Rentabilité par superviseur", periode: `${MOIS[mois - 1]} ${annee}`,
    genereLe: new Date().toISOString(), resume: [], colonnes, lignes,
  };
}

/** Prévision des collectes des 16èmes et 31èmes (§6). */
async function rapportPrevisionCollectes(annee: number, mois: number, pdv: number): Promise<RapportPOPC> {
  const debut = new Date(Date.UTC(annee, mois - 1, 1));
  const fin = new Date(Date.UTC(annee, mois, 1));
  const echeances = await prisma.echeanceCredit.findMany({
    where: {
      dateEcheance: { gte: debut, lt: fin },
      credit: { formule: { not: null }, ...(pdv ? { pointDeVenteId: pdv } : {}) },
    },
    select: {
      numeroEcheance: true, dateEcheance: true, montantDu: true,
      credit: { select: { formule: true, dureeJours: true } },
    },
    orderBy: { dateEcheance: "asc" },
  });
  const parDate = new Map<string, { s16: number; v16: number; s31: number; v31: number }>();
  let T16 = 0, T31 = 0, TV = 0;
  for (const e of echeances) {
    if (!estEcheanceRemuneration(e.credit.formule, e.numeroEcheance, e.credit.dureeJours)) continue;
    const k = e.dateEcheance.toISOString().slice(0, 10);
    const b = parDate.get(k) ?? { s16: 0, v16: 0, s31: 0, v31: 0 };
    const du = Number(e.montantDu);
    if (e.credit.formule === "QUINZAINE") { b.s16 += 1; b.v16 += du; T16 += 1; }
    else { b.s31 += 1; b.v31 += du; T31 += 1; }
    TV += du;
    parDate.set(k, b);
  }
  const lignes = Array.from(parDate.entries()).sort(([a], [b]) => a.localeCompare(b))
    .map(([d, b]) => [frDate(d), b.s16, Number(b.v16.toFixed(2)), b.s31, Number(b.v31.toFixed(2))]);
  return {
    code: "prevision-collectes", titre: "Prévision des collectes 16èmes / 31èmes", periode: `${MOIS[mois - 1]} ${annee}`,
    genereLe: new Date().toISOString(),
    resume: [{ label: "16èmes / 31èmes prévus", valeur: `${T16} / ${T31}` }, { label: "Valeur prévue", valeur: `${fmt(TV)} FCFA` }],
    colonnes: [
      { label: "Date", type: "text" }, { label: "16èmes", type: "number" }, { label: "Valeur 16es", type: "currency" },
      { label: "31èmes", type: "number" }, { label: "Valeur 31es", type: "currency" },
    ],
    lignes,
    totaux: ["Total", T16, Number((Array.from(parDate.values()).reduce((s, b) => s + b.v16, 0)).toFixed(2)), T31, Number((Array.from(parDate.values()).reduce((s, b) => s + b.v31, 0)).toFixed(2))],
  };
}

/** Prévision des besoins en nouveaux clients (§7 + objectif recrutement). */
async function rapportPrevisionClients(annee: number, mois: number, pdv: number): Promise<RapportPOPC> {
  const param = await prisma.parametragePOPC.findUnique({
    where: { annee_mois_pointDeVenteId: { annee, mois, pointDeVenteId: pdv } },
    include: { objectif: true },
  });
  const plan = await planifierLivraisons(annee, mois, pdv);
  const o = param?.objectif;
  const lignes: (string | number)[][] = o ? [
    ["Clients à recruter (objectif)", fmt(o.nbClientsRecruter)],
    ["Nouveaux crédits à livrer (objectif)", fmt(o.nbNouveauxCredits)],
    ["— dont Quinzaine (16èmes)", fmt(o.nbSeiziemes)],
    ["— dont Trentaine (31èmes)", fmt(o.nbTrentiemes)],
    ["Crédits Quinzaine déjà accordés", fmt(plan.resume.dejaQuinzaine)],
    ["Crédits Trentaine déjà accordés", fmt(plan.resume.dejaTrentaine)],
    ["Reste à livrer (Quinzaine)", fmt(plan.resume.resteQuinzaine)],
    ["Reste à livrer (Trentaine)", fmt(plan.resume.resteTrentaine)],
    ["Jours restants au mois", fmt(plan.resume.joursRestants)],
  ] : [];
  return {
    code: "prevision-clients", titre: "Prévision des besoins en nouveaux clients", periode: `${MOIS[mois - 1]} ${annee}`,
    genereLe: new Date().toISOString(),
    resume: o ? [{ label: "Clients à recruter", valeur: fmt(o.nbClientsRecruter) }] : [],
    colonnes: [{ label: "Indicateur", type: "text" }, { label: "Valeur", type: "text" }],
    lignes,
  };
}

/** Point d'entrée : génère le rapport demandé. */
export async function genererRapport(type: TypeRapport, p: ParamsRapport): Promise<RapportPOPC> {
  const pdv = p.pdv ?? 0;
  const date = p.date || new Date().toISOString().slice(0, 10);
  switch (type) {
    case "journalier": return rapportJournalier(date, pdv);
    case "hebdomadaire": return rapportPeriode("hebdomadaire", "Rapport hebdomadaire", date, 7, pdv);
    case "quinzaine": return rapportPeriode("quinzaine", "Rapport quinzaine (15 jours)", date, 15, pdv);
    case "trentaine": return rapportPeriode("trentaine", "Rapport trentaine (30 jours)", date, 30, pdv);
    case "mensuel": return rapportMensuel(p.annee, p.mois, pdv);
    case "annuel": return rapportAnnuel(p.annee, pdv);
    case "comparatif": return rapportComparatif(p.annee, p.mois, pdv);
    case "rentabilite-agence": return rapportRentabiliteAgence(p.annee, p.mois);
    case "rentabilite-commercial": return rapportRentabiliteCommercial(p.annee, p.mois);
    case "rentabilite-superviseur": return rapportRentabiliteSuperviseur(p.annee, p.mois);
    case "prevision-collectes": return rapportPrevisionCollectes(p.annee, p.mois, pdv);
    case "prevision-clients": return rapportPrevisionClients(p.annee, p.mois, pdv);
    default: throw new Error("TYPE_RAPPORT_INCONNU");
  }
}
