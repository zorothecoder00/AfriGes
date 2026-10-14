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

// Accepte aussi un Prisma.Decimal côté serveur (converti via Number/valueOf), sans
// import valeur de @prisma/client (lib utilisée côté client).
type Montant = number | string | { valueOf(): string | number };

/**
 * Montant RÉEL du crédit affiché au client/gestionnaire, hors rémunération
 * 16ème/31ème : montantTotal − montantInteret. Le montantTotal stocké (et donc
 * l'échéancier / le solde restant) inclut toujours la rémunération ; seul
 * l'affichage du « montant du crédit » l'exclut, par transparence.
 * Crédits historiques : montantInteret = 0 → identique à montantTotal.
 */
export function montantCreditReel(c: {
  montantTotal: Montant;
  montantInteret?: Montant | null;
}): number {
  const total = Number(c.montantTotal) || 0;
  const interet = Number(c.montantInteret ?? 0) || 0;
  return Number((total - interet).toFixed(2));
}

/**
 * Décompose le solde restant / le remboursé d'un crédit entre la part « crédit
 * réel » et la part rémunération (16ème/31ème). La rémunération étant la DERNIÈRE
 * échéance, elle est réglée en dernier : tant que le solde couvre la rémunération,
 * elle reste entièrement due.
 *  - remunerationRestante = min(soldeRestant, montantInteret)
 *  - soldeReel            = soldeRestant − remunerationRestante
 *  - rembourseReel        = montantCreditReel − soldeReel
 *  - remunerationPayee    = montantInteret − remunerationRestante
 *  - pctReel              = % du crédit réel remboursé (0–100)
 */
export function decomposerSoldeCredit(c: {
  montantTotal: Montant;
  montantInteret?: Montant | null;
  soldeRestant: Montant;
}) {
  const r2 = (n: number) => Number(n.toFixed(2));
  const reel = montantCreditReel(c);
  const interet = Math.max(0, Number(c.montantInteret ?? 0) || 0);
  const solde = Math.max(0, Number(c.soldeRestant) || 0);
  const remunerationRestante = Math.min(solde, interet);
  const soldeReel = Math.max(0, solde - remunerationRestante);
  const rembourseReel = Math.max(0, reel - soldeReel);
  return {
    soldeReel: r2(soldeReel),
    remunerationRestante: r2(remunerationRestante),
    rembourseReel: r2(rembourseReel),
    remunerationPayee: r2(interet - remunerationRestante),
    pctReel: reel > 0 ? Math.min(100, Math.round((rembourseReel / reel) * 100)) : 0,
  };
}
