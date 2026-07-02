/**
 * lib/composantsPaie.ts — Classification des composants de paie en 3 blocs :
 *   Salaire fixe · Salaire variable · Déductions.
 *
 * Le modèle ComposantSalaire ne stocke pas de catégorie « fixe/variable » : on la
 * dérive du `type` (+ `isRetenue`). Source unique de vérité, partagée entre les
 * bulletins React (admin/RH) et le bulletin HTML serveur (PDF/email).
 */

/** Types de gains considérés comme « salaire fixe » (récurrents, non liés à l'activité). */
export const TYPES_SALAIRE_FIXE = new Set<string>([
  "SALAIRE_BASE",
  "PRIME_ANCIENNETE",
  "PRIME_FONCTION",
  "PRIME_RESPONSABILITE",
  "PRIME_TRANSPORT",
  "PRIME_LOGEMENT",
]);

export type CategoriePaie = "FIXE" | "VARIABLE" | "DEDUCTION";

/** Catégorie d'un composant : DEDUCTION si retenue, sinon FIXE ou VARIABLE selon le type. */
export function categorieComposant(type: string, isRetenue: boolean): CategoriePaie {
  if (isRetenue) return "DEDUCTION";
  return TYPES_SALAIRE_FIXE.has(type) ? "FIXE" : "VARIABLE";
}

export interface ComposantLike {
  type: string;
  libelle: string;
  montant: number;
  isRetenue: boolean;
}

export interface GroupesPaie<T> {
  fixe: T[];
  variable: T[];
  deductions: T[];
  totalFixe: number;        // salaire de base inclus
  totalVariable: number;
  totalDeductions: number;
}

/**
 * Répartit les composants d'une fiche en 3 blocs et calcule leurs sous-totaux.
 * Le salaire de base (champ dédié de la fiche) est intégré au total « fixe ».
 */
export function grouperComposantsPaie<T extends ComposantLike>(
  composants: T[],
  salaireBase: number,
): GroupesPaie<T> {
  const fixe       = composants.filter((c) => !c.isRetenue && TYPES_SALAIRE_FIXE.has(c.type));
  const variable   = composants.filter((c) => !c.isRetenue && !TYPES_SALAIRE_FIXE.has(c.type));
  const deductions = composants.filter((c) => c.isRetenue);
  const sum = (arr: T[]) => arr.reduce((s, c) => s + Number(c.montant), 0);
  return {
    fixe,
    variable,
    deductions,
    totalFixe:       Number(salaireBase) + sum(fixe),
    totalVariable:   sum(variable),
    totalDeductions: sum(deductions),
  };
}
