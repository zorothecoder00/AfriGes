// lib/popc/realisationsServer.ts
// Calcul des RÉALISATIONS POPC à partir des données réelles (aucune ressaisie) :
//  - encaissements : RemboursementCredit au statut CONFIRME (module Collecte abandonné) ;
//  - 16èmes / 31èmes : dernière échéance (rémunération) des crédits à formule ;
//  - carnets : VenteCarnet.
// Serveur uniquement (accès Prisma). Les objectifs viennent d'ObjectifPOPC.

import { prisma } from "@/lib/prisma";

const CONFIRME = "CONFIRME";

/** Fenêtre [début, fin[ d'une journée (UTC) à partir de "YYYY-MM-DD". */
function fenetreJour(date: string): { debut: Date; fin: Date } {
  const [y, m, d] = date.split("-").map(Number);
  const debut = new Date(Date.UTC(y, m - 1, d));
  const fin = new Date(Date.UTC(y, m - 1, d + 1));
  return { debut, fin };
}

/** Fenêtre [début, fin[ d'un mois (UTC). */
function fenetreMois(annee: number, mois: number): { debut: Date; fin: Date } {
  return { debut: new Date(Date.UTC(annee, mois - 1, 1)), fin: new Date(Date.UTC(annee, mois, 1)) };
}

interface FiltrePDV { pointDeVenteId?: number | null }

/**
 * Réalisations d'une période [debut, fin[ (partagé jour/mois).
 * Le « 16ème / 31ème » réalisé = échéance de rémunération (numeroEcheance ===
 * dureeJours d'un crédit à formule) au statut PAYE dont l'échéance tombe dans la
 * période — cohérent avec la prévision (§6).
 */
async function realisationsPeriode(debut: Date, fin: Date, filtre: FiltrePDV) {
  const pdv = filtre.pointDeVenteId ?? null;
  const creditPDV = pdv != null ? { pointDeVenteId: pdv } : {};

  // Échéances de rémunération de la période (crédits à formule).
  const echeances = await prisma.echeanceCredit.findMany({
    where: {
      dateEcheance: { gte: debut, lt: fin },
      credit: { formule: { not: null }, ...creditPDV },
    },
    select: {
      numeroEcheance: true, montantDu: true, montantPaye: true, statut: true,
      credit: { select: { formule: true, dureeJours: true } },
    },
  });

  let nb16 = 0, nb31 = 0, nb16Real = 0, nb31Real = 0;
  let revenu16Prevu = 0, revenu31Prevu = 0, revenu16Real = 0, revenu31Real = 0;
  for (const e of echeances) {
    if (e.numeroEcheance !== e.credit.dureeJours) continue; // pas la dernière échéance
    const paye = e.statut === "PAYE";
    if (e.credit.formule === "QUINZAINE") {
      nb16 += 1; revenu16Prevu += Number(e.montantDu);
      if (paye) { nb16Real += 1; revenu16Real += Number(e.montantPaye); }
    } else if (e.credit.formule === "TRENTAINE") {
      nb31 += 1; revenu31Prevu += Number(e.montantDu);
      if (paye) { nb31Real += 1; revenu31Real += Number(e.montantPaye); }
    }
  }

  // Encaissements confirmés de la période (toutes mises confondues).
  const remboursements = await prisma.remboursementCredit.findMany({
    where: {
      statut: CONFIRME,
      dateRemboursement: { gte: debut, lt: fin },
      ...(pdv != null && { credit: { pointDeVenteId: pdv } }),
    },
    select: { montant: true, credit: { select: { clientId: true } } },
  });
  const montantCollecte = remboursements.reduce((s, r) => s + Number(r.montant), 0);
  const clientsCollectes = new Set(remboursements.map((r) => r.credit.clientId)).size;

  // Nouveaux crédits livrés (créés dans la période).
  const nouveauxCredits = await prisma.creditClient.findMany({
    where: { dateDebut: { gte: debut, lt: fin }, ...creditPDV },
    select: { clientId: true },
  });
  const nbNouveauxCredits = nouveauxCredits.length;
  const clientsLivres = new Set(nouveauxCredits.map((c) => c.clientId)).size;

  // Carnets vendus.
  const carnets = await prisma.venteCarnet.aggregate({
    where: { dateVente: { gte: debut, lt: fin }, ...(pdv != null && { pointDeVenteId: pdv }) },
    _count: { _all: true }, _sum: { montant: true },
  });
  const carnetsVendus = carnets._count._all;
  const revenuCarnets = Number(carnets._sum.montant ?? 0);

  const round = (v: number) => Number(v.toFixed(2));
  return {
    nb16, nb31, nb16Real, nb31Real,
    revenu16Prevu: round(revenu16Prevu), revenu31Prevu: round(revenu31Prevu),
    revenu16Real: round(revenu16Real), revenu31Real: round(revenu31Real),
    montantCollecte: round(montantCollecte), clientsCollectes,
    nbNouveauxCredits, clientsLivres,
    carnetsVendus, revenuCarnets: round(revenuCarnets),
    revenuGenere: round(revenu16Real + revenu31Real + revenuCarnets),
  };
}

/** Objectifs du mois (ObjectifPOPC) + paramètre jours ouvrables, pour dériver le quotidien. */
async function objectifsDuMois(annee: number, mois: number, pdv: number) {
  const param = await prisma.parametragePOPC.findUnique({
    where: { annee_mois_pointDeVenteId: { annee, mois, pointDeVenteId: pdv } },
    include: { objectif: true },
  });
  return param;
}

export interface IndicateurSuivi { indicateur: string; objectif: number; realise: number; reste: number }

/** §8 — Tableau de suivi journalier (objectif / réalisé / reste). */
export async function calculerSuiviJournalier(date: string, pdv: number) {
  const { debut, fin } = fenetreJour(date);
  const r = await realisationsPeriode(debut, fin, { pointDeVenteId: pdv || null });

  const param = await objectifsDuMois(new Date(date).getUTCFullYear(), new Date(date).getUTCMonth() + 1, pdv);
  const o = param?.objectif ?? null;
  const jours = param?.joursOuvrables && param.joursOuvrables > 0 ? param.joursOuvrables : 26;
  const parJour = (total: number | undefined) => (total ? Math.ceil(Number(total) / jours) : 0);
  const revenuJour = o ? Number(o.objectifQuotidien) : 0;

  const ligne = (indicateur: string, objectif: number, realise: number): IndicateurSuivi => ({
    indicateur, objectif, realise, reste: Number(Math.max(0, objectif - realise).toFixed(2)),
  });

  const indicateurs: IndicateurSuivi[] = [
    ligne("Clients livrés", parJour(o?.nbNouveauxCredits), r.clientsLivres),
    ligne("Clients collectés", parJour(o?.nbNouveauxCredits), r.clientsCollectes),
    ligne("Nombre de 16èmes", parJour(o?.nbSeiziemes), r.nb16Real),
    ligne("Nombre de 31èmes", parJour(o?.nbTrentiemes), r.nb31Real),
    ligne("Carnets vendus", parJour(o?.nbCarnets), r.carnetsVendus),
    ligne("Montant collecté", revenuJour, r.montantCollecte),
    ligne("Revenu généré", parJour(o ? Number(o.revenuMinimum) : 0), r.revenuGenere),
  ];
  const tauxRealisation = revenuJour > 0 ? Number(((r.montantCollecte / revenuJour) * 100).toFixed(1)) : 0;

  return { date, pointDeVenteId: pdv, indicateurs, tauxRealisation, objectifsGeneres: !!o, realisations: r };
}

/** §11 — Tableau de pilotage de la Direction (consolidé mensuel). */
export async function calculerConsolidationDirection(annee: number, mois: number, pdv: number) {
  const { debut, fin } = fenetreMois(annee, mois);
  const r = await realisationsPeriode(debut, fin, { pointDeVenteId: pdv || null });
  const param = await objectifsDuMois(annee, mois, pdv);
  const o = param?.objectif ?? null;

  const chargesTotales = o ? Number(o.chargesTotales) : 0;
  const revenuMinimum = o ? Number(o.revenuMinimum) : 0;
  const revenusAttendus = Number((r.revenu16Prevu + r.revenu31Prevu + r.revenuCarnets).toFixed(2));
  const revenusEncaisses = r.revenuGenere;

  // Clients actifs (au moins un crédit ACTIF/EN_RETARD), scopé PDV si fourni.
  const clientsActifs = await prisma.creditClient.findMany({
    where: {
      statut: { in: ["ACTIF", "EN_RETARD"] },
      ...(pdv ? { pointDeVenteId: pdv } : {}),
    },
    select: { clientId: true }, distinct: ["clientId"],
  });

  const chargesCouvertes = chargesTotales > 0
    ? Number(((revenusEncaisses / chargesTotales) * 100).toFixed(1)) : 0;
  const resultatPrevisionnel = Number((revenusAttendus - chargesTotales).toFixed(2));
  const beneficeEstime = Number((revenusEncaisses - chargesTotales).toFixed(2));
  const objectifAtteint = revenuMinimum > 0 && revenusEncaisses >= revenuMinimum;

  return {
    annee, mois, pointDeVenteId: pdv, objectifsGeneres: !!o,
    chargesTotales, revenuMinimum,
    chargesCouvertes, resultatPrevisionnel, beneficeEstime,
    clientsActifs: clientsActifs.length,
    nouveauxCredits: r.nbNouveauxCredits,
    seiziemesAttendus: r.nb16, trentiemesAttendus: r.nb31,
    revenusAttendus, revenusEncaisses,
    carnetsVendus: r.carnetsVendus,
    objectifAtteint,
  };
}
