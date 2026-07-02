/**
 * lib/calcAnciennete.ts — Prime d'ancienneté automatique de la paie.
 *
 * À la génération d'un bulletin, calcule une prime d'ancienneté en % du salaire
 * de base selon les années de service (depuis `ProfilRH.dateEmbauche`).
 *
 * Barème par défaut (convention type OHADA, facilement ajustable ci-dessous) :
 *   - aucune prime en dessous de 2 ans de service ;
 *   - 2 % du salaire de base à 2 ans ;
 *   - +1 % par année supplémentaire ;
 *   - plafonné à 30 % (atteint à 30 ans d'ancienneté).
 *
 * Pour adapter la politique, modifiez les constantes ou la fonction `tauxAnciennete`.
 */

export const ANCIENNETE_SEUIL_ANNEES = 2;   // années minimales pour ouvrir droit
export const ANCIENNETE_TAUX_BASE    = 2;   // % du salaire de base au seuil
export const ANCIENNETE_TAUX_PLAFOND = 30;  // % maximum

/** Nombre d'années entières de service entre l'embauche et une date de référence. */
export function anneesDeService(dateEmbauche: Date, ref: Date): number {
  let annees = ref.getFullYear() - dateEmbauche.getFullYear();
  const m = ref.getMonth() - dateEmbauche.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < dateEmbauche.getDate())) annees--;
  return Math.max(0, annees);
}

/** Taux (%) de la prime d'ancienneté pour un nombre d'années de service. */
export function tauxAnciennete(annees: number): number {
  if (annees < ANCIENNETE_SEUIL_ANNEES) return 0;
  return Math.min(
    ANCIENNETE_TAUX_BASE + (annees - ANCIENNETE_SEUIL_ANNEES),
    ANCIENNETE_TAUX_PLAFOND,
  );
}

export interface ComposantAnciennete {
  type: "PRIME_ANCIENNETE";
  libelle: string;
  montant: number;
  isRetenue: false;
  ordre: number;
}

/**
 * Prime d'ancienneté d'un collaborateur pour une période de paie.
 * Retourne 0 ou 1 composant gain (PRIME_ANCIENNETE). L'ancienneté est arrêtée
 * au dernier jour du mois de paie.
 */
export function calculerPrimeAnciennete(
  dateEmbauche: Date | string | null,
  salaireBase: number,
  mois: number,
  annee: number,
): ComposantAnciennete[] {
  if (!dateEmbauche || !salaireBase || salaireBase <= 0) return [];

  const embauche = new Date(dateEmbauche);
  if (Number.isNaN(embauche.getTime())) return [];

  const ref    = new Date(annee, mois, 0); // dernier jour du mois de paie (mois 1–12)
  const annees = anneesDeService(embauche, ref);
  const taux   = tauxAnciennete(annees);
  if (taux <= 0) return [];

  const montant = Math.round((salaireBase * taux) / 100);
  if (montant <= 0) return [];

  return [{
    type:      "PRIME_ANCIENNETE",
    libelle:   `Prime d'ancienneté — ${annees} an${annees > 1 ? "s" : ""} (${taux} %)`,
    montant,
    isRetenue: false,
    ordre:     10,
  }];
}
