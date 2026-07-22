// lib/popc/realisationsServer.ts
// Calcul des RÉALISATIONS POPC à partir des données réelles (aucune ressaisie) :
//  - encaissements : RemboursementCredit au statut CONFIRME (module Collecte abandonné) ;
//  - 16èmes / 31èmes : dernière échéance (rémunération) des crédits à formule ;
//  - carnets : VenteCarnet.
// Serveur uniquement (accès Prisma). Les objectifs viennent d'ObjectifPOPC.

import { prisma } from "@/lib/prisma";
import { chargesReellesComptables } from "@/lib/popc/comptabiliteServer";

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

  // Portrait clientèle crédit (snapshot courant, scopé PDV) : actifs / en retard /
  // soldés — comptés en clients DISTINCTS (un client peut cumuler plusieurs crédits).
  // §5 exige de récupérer automatiquement les clients soldés et en retard.
  const scopePDV = pdv ? { pointDeVenteId: pdv } : {};
  const [clientsActifs, clientsEnRetardRows, clientsSoldesRows] = await Promise.all([
    prisma.creditClient.findMany({
      where: { statut: { in: ["ACTIF", "EN_RETARD"] }, ...scopePDV },
      select: { clientId: true }, distinct: ["clientId"],
    }),
    prisma.creditClient.findMany({
      where: { statut: "EN_RETARD", ...scopePDV },
      select: { clientId: true }, distinct: ["clientId"],
    }),
    prisma.creditClient.findMany({
      where: { statut: "SOLDE", ...scopePDV },
      select: { clientId: true }, distinct: ["clientId"],
    }),
  ]);

  const chargesCouvertes = chargesTotales > 0
    ? Number(((revenusEncaisses / chargesTotales) * 100).toFixed(1)) : 0;
  const resultatPrevisionnel = Number((revenusAttendus - chargesTotales).toFixed(2));
  const beneficeEstime = Number((revenusEncaisses - chargesTotales).toFixed(2));
  const objectifAtteint = revenuMinimum > 0 && revenusEncaisses >= revenuMinimum;

  // §15.1 — Comparaison charges budget/réel. La compta n'étant pas ventilée par
  // PDV, la comparaison n'est fournie qu'au niveau global (pdv=0).
  let comparaisonChargesDisponible = false;
  let chargesReelles = 0;
  let ecartCharges = 0;
  let tauxConsommationCharges = 0;
  let chargesParCompte: { numero: string; libelle: string; montant: number }[] = [];
  if (!pdv) {
    const cr = await chargesReellesComptables(annee, mois);
    comparaisonChargesDisponible = true;
    chargesReelles = cr.reel;
    chargesParCompte = cr.parCompte;
    ecartCharges = Number((chargesReelles - chargesTotales).toFixed(2));
    tauxConsommationCharges = chargesTotales > 0
      ? Number(((chargesReelles / chargesTotales) * 100).toFixed(1)) : 0;
  }

  return {
    annee, mois, pointDeVenteId: pdv, objectifsGeneres: !!o,
    chargesTotales, revenuMinimum,
    chargesCouvertes, resultatPrevisionnel, beneficeEstime,
    clientsActifs: clientsActifs.length,
    clientsEnRetard: clientsEnRetardRows.length,
    clientsSoldes: clientsSoldesRows.length,
    nouveauxCredits: r.nbNouveauxCredits,
    seiziemesAttendus: r.nb16, trentiemesAttendus: r.nb31,
    revenusAttendus, revenusEncaisses,
    carnetsVendus: r.carnetsVendus,
    objectifAtteint,
    // §15.1 — budget vs réel (charges comptables), global uniquement.
    comparaisonChargesDisponible, chargesReelles, ecartCharges, tauxConsommationCharges, chargesParCompte,
  };
}

/**
 * §9 — Tableau de bord personnel d'un commercial (AGENT_TERRAIN) sur un mois.
 * Ses données uniquement, alimentées automatiquement :
 *  - affectés : ClientAgentAffectation actif ∪ Client.agentTerrainId ;
 *  - visités : VisiteClient (REALISEE) ; recrutés : clients créés dans le mois ;
 *  - crédits livrés : crédits créés par l'agent ;
 *  - 16/31 collectés : remboursements confirmés de l'agent sur la dernière échéance
 *    (numeroJour === dureeJours) d'un crédit à formule ;
 *  - carnets : VenteCarnet de l'agent.
 */
export async function calculerTableauCommercial(agentId: number, annee: number, mois: number) {
  const { debut, fin } = fenetreMois(annee, mois);

  // Portefeuille de l'agent (affectation dédiée ∪ agent legacy).
  const clientsPortefeuille = await prisma.client.findMany({
    where: {
      OR: [
        { agentTerrainId: agentId },
        { agentAffectations: { some: { agentId, actif: true } } },
      ],
    },
    select: { id: true, createdAt: true },
  });
  const clientsAffectes = clientsPortefeuille.length;
  const nouveauxClientsRecrutes = clientsPortefeuille.filter(
    (c) => c.createdAt >= debut && c.createdAt < fin,
  ).length;

  // Visites réalisées dans le mois (clients distincts).
  const visites = await prisma.visiteClient.findMany({
    where: { agentId, statut: "REALISEE", dateVisite: { gte: debut, lt: fin } },
    select: { clientId: true },
  });
  const clientsVisites = new Set(visites.map((v) => v.clientId)).size;
  const clientsRestants = Math.max(0, clientsAffectes - clientsVisites);

  // Crédits livrés (créés par l'agent) dans le mois.
  const creditsLivres = await prisma.creditClient.count({
    where: { creeParId: agentId, dateDebut: { gte: debut, lt: fin } },
  });

  // Collectes de rémunération (16/31) réalisées par l'agent : remboursement confirmé
  // sur la dernière échéance (numeroJour === dureeJours) d'un crédit à formule.
  const remb = await prisma.remboursementCredit.findMany({
    where: {
      agentCollecteurId: agentId, statut: CONFIRME,
      dateRemboursement: { gte: debut, lt: fin },
      credit: { formule: { not: null } },
    },
    select: { numeroJour: true, credit: { select: { formule: true, dureeJours: true } } },
  });
  let seiziemesCollectes = 0, trentiemesCollectes = 0;
  for (const x of remb) {
    if (x.numeroJour == null || x.numeroJour !== x.credit.dureeJours) continue;
    if (x.credit.formule === "QUINZAINE") seiziemesCollectes += 1;
    else if (x.credit.formule === "TRENTAINE") trentiemesCollectes += 1;
  }

  // Montant total collecté par l'agent (toutes mises) → taux de réalisation.
  const montantAgg = await prisma.remboursementCredit.aggregate({
    where: { agentCollecteurId: agentId, statut: CONFIRME, dateRemboursement: { gte: debut, lt: fin } },
    _sum: { montant: true },
  });
  const montantCollecte = Number(montantAgg._sum.montant ?? 0);

  // Carnets vendus par l'agent.
  const carnets = await prisma.venteCarnet.count({
    where: { agentId, dateVente: { gte: debut, lt: fin } },
  });

  // Objectif individuel = objectif mensuel / nombre d'agents terrain (ObjectifPOPC global).
  const param = await objectifsDuMois(annee, mois, 0);
  const objectifMensuel = param?.objectif ? Number(param.objectif.objectifMensuel) : 0;
  const nbAgents = param?.nombreAgentsTerrain && param.nombreAgentsTerrain > 0 ? param.nombreAgentsTerrain : 1;
  const objectifAgent = Number((objectifMensuel / nbAgents).toFixed(2));
  const tauxRealisation = objectifAgent > 0
    ? Number(((montantCollecte / objectifAgent) * 100).toFixed(1)) : 0;

  return {
    agentId, annee, mois,
    clientsAffectes, clientsVisites, clientsRestants, nouveauxClientsRecrutes,
    creditsLivres, seiziemesCollectes, trentiemesCollectes, carnetsVendus: carnets,
    montantCollecte: Number(montantCollecte.toFixed(2)),
    objectifAgent, tauxRealisation, objectifsGeneres: !!param?.objectif,
  };
}
