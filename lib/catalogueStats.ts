/**
 * Catalogue intelligent (Catalogue §14/§19, Enterprise #3) — calculs purs de
 * rotation, jours de stock, date probable de rupture et suggestion de réappro.
 * Sans accès base : les données brutes (stock, ventes sur période) sont fournies
 * par l'API `/api/admin/catalogue/stats`.
 */

// Types de sortie de stock considérés comme « consommation commerciale » pour
// le calcul de la rotation (on exclut transferts, ajustements, pertes…).
export const SORTIES_VENTE = ["VENTE_DIRECTE", "LIVRAISON_PACK", "LIVRAISON_CLIENT"] as const;

export type StatutStock = "RUPTURE" | "CRITIQUE" | "FAIBLE" | "OK" | "DORMANT";

export const STATUT_STOCK_LABEL: Record<StatutStock, string> = {
  RUPTURE: "Rupture", CRITIQUE: "Critique", FAIBLE: "Faible", OK: "Sain", DORMANT: "Dormant",
};

export interface EntreeMetrique {
  produitId: number;
  nom: string;
  codeProduit: string | null;
  stockActuel: number;
  prixAchat: number | null;
  prixVente: number;
  quantiteVendue: number; // sur la période analysée
  stockMin: number | null; // seuil de réappro agrégé (max des stockMin configurés)
}

export interface MetriqueProduit extends EntreeMetrique {
  valeurStock: number;         // stock × coût unitaire (achat, sinon vente)
  consoJournaliere: number;    // quantité vendue / jours de période
  joursDeStock: number | null; // null = pas de consommation (stock « figé »)
  dateRupture: string | null;  // ISO, date probable de rupture
  rotation: number;            // quantité vendue / stock (sur la période)
  statutStock: StatutStock;
  quantiteReappro: number;     // quantité suggérée à réapprovisionner
}

export interface ParamsAnalyse {
  periodeJours: number;   // fenêtre d'analyse des ventes (ex : 30)
  horizonJours: number;   // couverture cible pour le réappro (ex : 30)
  seuilRuptureJours: number; // sous ce nb de jours de stock → réappro conseillé (ex : 7)
}

export const PARAMS_DEFAUT: ParamsAnalyse = { periodeJours: 30, horizonJours: 30, seuilRuptureJours: 7 };

/** Consommation journalière moyenne sur la période. */
export function consoJournaliere(quantiteVendue: number, periodeJours: number): number {
  if (periodeJours <= 0) return 0;
  return quantiteVendue / periodeJours;
}

/** Nombre de jours avant rupture au rythme actuel (null si pas de consommation). */
export function joursDeStock(stock: number, conso: number): number | null {
  if (conso <= 0) return null;
  return stock / conso;
}

/** Date probable de rupture (null si stock figé ou déjà en rupture). */
export function dateRupture(jours: number | null, now: Date = new Date()): string | null {
  if (jours == null) return null;
  const d = new Date(now.getTime() + jours * 86400000);
  return d.toISOString();
}

/**
 * Quantité suggérée à réapprovisionner : couvrir `horizonJours` de consommation
 * (moins le stock déjà présent), avec un plancher pour remonter au stock minimum.
 * Renvoie 0 si aucun réappro n'est nécessaire.
 */
export function suggestionReappro(
  conso: number, stock: number, horizonJours: number, stockMin: number | null,
): number {
  const cible = conso * horizonJours;
  let besoin = cible - stock;
  if (stockMin != null && stock < stockMin) besoin = Math.max(besoin, stockMin - stock);
  return besoin > 0 ? Math.ceil(besoin) : 0;
}

/** Classe le produit selon son état de stock et sa consommation. */
export function classerStock(
  stock: number, conso: number, jours: number | null, seuilRuptureJours: number,
): StatutStock {
  if (stock <= 0) return "RUPTURE";
  if (conso <= 0) return "DORMANT"; // du stock mais aucune vente sur la période
  if (jours != null && jours <= seuilRuptureJours / 2) return "CRITIQUE";
  if (jours != null && jours <= seuilRuptureJours) return "FAIBLE";
  return "OK";
}

/** Calcule toutes les métriques d'un produit. */
export function calculerMetrique(e: EntreeMetrique, params: ParamsAnalyse, now: Date = new Date()): MetriqueProduit {
  const conso = consoJournaliere(e.quantiteVendue, params.periodeJours);
  const jours = joursDeStock(e.stockActuel, conso);
  const coutUnitaire = e.prixAchat ?? e.prixVente;
  return {
    ...e,
    valeurStock: Math.round(e.stockActuel * coutUnitaire),
    consoJournaliere: Math.round(conso * 100) / 100,
    joursDeStock: jours != null ? Math.round(jours * 10) / 10 : null,
    dateRupture: dateRupture(jours, now),
    rotation: e.stockActuel > 0 ? Math.round((e.quantiteVendue / e.stockActuel) * 100) / 100 : 0,
    statutStock: classerStock(e.stockActuel, conso, jours, params.seuilRuptureJours),
    quantiteReappro: suggestionReappro(conso, e.stockActuel, params.horizonJours, e.stockMin),
  };
}

export interface SyntheseCatalogue {
  produitsActifs: number;
  valeurStockTotale: number;
  enRupture: number;
  enCritique: number;
  enFaible: number;
  dormants: number;
  aReapprovisionner: number;
}

/** Agrège les métriques en KPIs de synthèse (§14). */
export function synthese(metriques: MetriqueProduit[]): SyntheseCatalogue {
  return {
    produitsActifs: metriques.length,
    valeurStockTotale: metriques.reduce((s, m) => s + m.valeurStock, 0),
    enRupture: metriques.filter((m) => m.statutStock === "RUPTURE").length,
    enCritique: metriques.filter((m) => m.statutStock === "CRITIQUE").length,
    enFaible: metriques.filter((m) => m.statutStock === "FAIBLE").length,
    dormants: metriques.filter((m) => m.statutStock === "DORMANT").length,
    aReapprovisionner: metriques.filter((m) => m.quantiteReappro > 0).length,
  };
}
