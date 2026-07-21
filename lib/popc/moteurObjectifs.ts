// lib/popc/moteurObjectifs.ts
// Moteur de planification descendante (CDC §4) — logique PURE, testable, sans I/O.
//
// Chaîne de calcul :
//   Charges totales + Objectif de bénéfice  ──► Revenu minimum à générer
//        │ (réparti selon le mix 16/31/carnet)
//        ▼
//   Nb de 16èmes / 31èmes / carnets  ──► Nb de nouveaux crédits ──► Nb de clients
//        ▼
//   Objectifs quotidien / hebdomadaire / mensuel (en revenu)
//
// Toutes les hypothèses non fixées par le CDC (répartition du revenu, crédits par
// client) sont des PARAMÈTRES calibrables par la Direction — pas des constantes.

export interface ParametresPOPC {
  // Charges (FCFA)
  salaireAgents: number;
  salaireSuperviseurs: number;
  salaireControleurs: number;
  salaireResponsables: number;
  carburant: number;
  entretienMotos: number;
  telephone: number;
  internet: number;
  loyer: number;
  eau: number;
  electricite: number;
  fournitures: number;
  publicite: number;
  divers: number;
  // Commerciaux
  objectifBenefice: number;
  commissionSeizieme: number;
  commissionTrentaine: number;
  prixCarnet: number;
  joursOuvrables: number;
  nombreAgentsTerrain: number;
  nombreAgences: number;
  // Hypothèses de planification
  partRevenu16: number;     // %
  partRevenu31: number;     // %
  partRevenuCarnet: number; // %
  creditsParClient: number;
}

export interface ObjectifsCalcules {
  chargesTotales: number;
  objectifBenefice: number;
  revenuMinimum: number;
  nbSeiziemes: number;
  nbTrentiemes: number;
  nbCarnets: number;
  nbNouveauxCredits: number;
  nbClientsRecruter: number;
  objectifQuotidien: number;
  objectifHebdomadaire: number;
  objectifMensuel: number;
  // Détail utile aux tableaux de bord (dérivés)
  objectifParAgent: number;   // revenu/jour/agent terrain
  objectifParAgence: number;  // revenu/jour/agence
  detailRevenu: { source16: number; source31: number; sourceCarnet: number };
}

const CHARGES_KEYS: (keyof ParametresPOPC)[] = [
  "salaireAgents", "salaireSuperviseurs", "salaireControleurs", "salaireResponsables",
  "carburant", "entretienMotos", "telephone", "internet", "loyer", "eau",
  "electricite", "fournitures", "publicite", "divers",
];

const n = (v: number | null | undefined): number => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

/** Somme des 14 lignes de charges (CDC §3.1 « Charges Totales »). */
export function calculerChargesTotales(p: ParametresPOPC): number {
  return Number(CHARGES_KEYS.reduce((s, k) => s + n(p[k] as number), 0).toFixed(2));
}

/** ceil sécurisé : division par 0 → 0 (paramètre non saisi). */
function nbDepuisRevenu(revenuCible: number, commissionUnitaire: number): number {
  const c = n(commissionUnitaire);
  if (c <= 0) return 0;
  return Math.ceil(n(revenuCible) / c);
}

/**
 * Génère le tableau de synthèse (CDC §4) à partir du paramétrage.
 * Déterministe : mêmes paramètres ⇒ mêmes objectifs (recalcul temps réel §15.3).
 */
export function calculerObjectifs(p: ParametresPOPC): ObjectifsCalcules {
  const chargesTotales = calculerChargesTotales(p);
  const objectifBenefice = n(p.objectifBenefice);
  const revenuMinimum = Number((chargesTotales + objectifBenefice).toFixed(2));

  // Répartition du revenu-cible entre les 3 sources. Normalisée si la somme des
  // parts ≠ 100 (robustesse : la Direction peut saisir 50/40/10 ou 5/4/1…).
  const sommeParts = n(p.partRevenu16) + n(p.partRevenu31) + n(p.partRevenuCarnet);
  const norm = sommeParts > 0 ? sommeParts : 1;
  const source16 = Number((revenuMinimum * n(p.partRevenu16) / norm).toFixed(2));
  const source31 = Number((revenuMinimum * n(p.partRevenu31) / norm).toFixed(2));
  const sourceCarnet = Number((revenuMinimum * n(p.partRevenuCarnet) / norm).toFixed(2));

  const nbSeiziemes = nbDepuisRevenu(source16, p.commissionSeizieme);
  const nbTrentiemes = nbDepuisRevenu(source31, p.commissionTrentaine);
  const nbCarnets = nbDepuisRevenu(sourceCarnet, p.prixCarnet);

  // Chaque 16ème provient d'un crédit Quinzaine arrivé à terme, chaque 31ème d'un
  // crédit Trentaine. Le nb de nouveaux crédits à livrer soutient ce flux.
  const nbNouveauxCredits = nbSeiziemes + nbTrentiemes;

  const cpc = n(p.creditsParClient) > 0 ? n(p.creditsParClient) : 1;
  const nbClientsRecruter = Math.ceil(nbNouveauxCredits / cpc);

  const jours = n(p.joursOuvrables) > 0 ? n(p.joursOuvrables) : 1;
  const objectifMensuel = revenuMinimum;
  const objectifQuotidien = Number((objectifMensuel / jours).toFixed(2));
  // Semaine ouvrable ≈ 6 jours ; hebdo = quotidien × 6.
  const objectifHebdomadaire = Number((objectifQuotidien * 6).toFixed(2));

  const agents = n(p.nombreAgentsTerrain) > 0 ? n(p.nombreAgentsTerrain) : 1;
  const agences = n(p.nombreAgences) > 0 ? n(p.nombreAgences) : 1;

  return {
    chargesTotales,
    objectifBenefice,
    revenuMinimum,
    nbSeiziemes,
    nbTrentiemes,
    nbCarnets,
    nbNouveauxCredits,
    nbClientsRecruter,
    objectifQuotidien,
    objectifHebdomadaire,
    objectifMensuel,
    objectifParAgent: Number((objectifQuotidien / agents).toFixed(2)),
    objectifParAgence: Number((objectifQuotidien / agences).toFixed(2)),
    detailRevenu: { source16, source31, sourceCarnet },
  };
}
