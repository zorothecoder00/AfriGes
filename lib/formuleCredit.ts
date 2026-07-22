// lib/formuleCredit.ts
// Formules commerciales de crédit (module POPC) — logique PURE (aucun import Prisma
// valeur), utilisable côté client comme serveur.
//
// Modèle métier (CDC AfriSime) :
//  - QUINZAINE : le client rembourse sa mise pendant 15 jours, puis paie une 16ème
//    collecte (la rémunération de l'entreprise). L'échéancier comporte 16 échéances.
//  - TRENTAINE : 30 mises + une 31ème collecte de rémunération. 31 échéances.
//
// Le « 16ème / 31ème » = la DERNIÈRE échéance de l'échéancier (numeroEcheance ===
// dureeJours) d'un crédit dont la formule est renseignée. C'est cette échéance que
// le module POPC compte et valorise (§6).

export type Formule = "QUINZAINE" | "TRENTAINE";

export interface FormuleConfig {
  label: string;
  /** Nombre de mises journalières remboursant le crédit (hors collecte de rémunération). */
  misesPrincipal: number;
  /** Nombre total d'échéances = mises + collecte de rémunération. Pilote dureeJours. */
  dureeJours: number;
  /** Rang de l'échéance de rémunération (= dureeJours). 16 (Quinzaine) ou 31 (Trentaine). */
  rangRemuneration: number;
}

export const FORMULE_CONFIG: Record<Formule, FormuleConfig> = {
  QUINZAINE: { label: "Quinzaine", misesPrincipal: 15, dureeJours: 16, rangRemuneration: 16 },
  TRENTAINE: { label: "Trentaine", misesPrincipal: 30, dureeJours: 31, rangRemuneration: 31 },
};

export const FORMULES: Formule[] = ["QUINZAINE", "TRENTAINE"];

export function estFormuleValide(v: unknown): v is Formule {
  return v === "QUINZAINE" || v === "TRENTAINE";
}

/** Durée (nombre d'échéances) imposée par la formule. */
export function dureeJoursPourFormule(f: Formule): number {
  return FORMULE_CONFIG[f].dureeJours;
}

/** Rang de l'échéance de rémunération (16ème / 31ème). */
export function rangRemuneration(f: Formule): number {
  return FORMULE_CONFIG[f].rangRemuneration;
}

/**
 * Une échéance est-elle la collecte de rémunération (16ème / 31ème) ?
 * True si la formule est renseignée et que le rang de l'échéance == durée du crédit.
 */
export function estEcheanceRemuneration(
  formule: Formule | null | undefined,
  numeroEcheance: number,
  dureeJours: number,
): boolean {
  if (!formule) return false;
  return numeroEcheance === dureeJours;
}

/**
 * Rémunération de l'entreprise sur un crédit (CDC : le « 16ème / 31ème » = UNE mise
 * journalière supplémentaire). = valeur des produits ÷ nombre de mises principales
 * (÷15 pour Quinzaine, ÷30 pour Trentaine). C'est le profit intégré au montant total.
 */
export function remunerationFormule(valeurProduits: number, f: Formule): number {
  const mises = FORMULE_CONFIG[f].misesPrincipal;
  if (mises <= 0) return 0;
  return Number((Number(valeurProduits) / mises).toFixed(2));
}

/** Taux de rémunération équivalent (%) : 100 ÷ mises principales (≈6,67 % / 3,33 %). */
export function tauxRemuneration(f: Formule): number {
  const mises = FORMULE_CONFIG[f].misesPrincipal;
  return mises > 0 ? Number((100 / mises).toFixed(4)) : 0;
}

/** Libellé lisible d'une formule (fallback pour les crédits historiques sans formule). */
export function libelleFormule(f: Formule | null | undefined): string {
  if (!f) return "—";
  return FORMULE_CONFIG[f].label;
}
