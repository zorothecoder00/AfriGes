// lib/echeancierCredit.ts
// Arrondi monétaire FCFA des montants d'échéances de crédit.
//
// Le franc CFA se manipule en pratique par pas de 25 (…00, 25, 50, 75) : on ne
// veut pas afficher au client un montant journalier « bizarre » comme 3 333,33.
// On arrondit donc le montant journalier au multiple de 25 le plus proche ; la
// dernière échéance absorbe le résidu pour que la somme reste EXACTEMENT égale au
// montant total dû (aucune perte, aucun centime créé).

/** Arrondit un montant au multiple de 25 FCFA le plus proche (…00, 25, 50, 75). */
export function arrondiCFA(v: number): number {
  return Math.round(v / 25) * 25;
}

/**
 * Montant journalier d'un crédit, arrondi au multiple de 25 FCFA.
 * `duree` doit être ≥ 1 (garde-fou : renvoie le total sinon).
 *
 * Garde-fou anti-négatif : la dernière échéance vaut `total − journalier×(durée−1)`.
 * Pour des journaliers minuscules, l'arrondi au multiple de 25 supérieur pourrait
 * la rendre négative ; dans ce cas rare on arrondit à l'inférieur pour garantir
 * `journalier × (durée−1) < total` (dernière échéance toujours positive).
 */
export function montantJournalierArrondi(montantTotal: number, duree: number): number {
  if (duree < 1) return arrondiCFA(montantTotal);
  const proche = arrondiCFA(montantTotal / duree);
  if (proche * (duree - 1) >= montantTotal) {
    return Math.floor(montantTotal / duree / 25) * 25;
  }
  return proche;
}
