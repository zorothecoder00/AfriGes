/**
 * lib/rfqComparatif.ts — Comparatif automatique des cotations RFQ
 * (CDC Approvisionnement §7 étape 6 : classement coût/délai/qualité + recommandation).
 *
 * Fonction pure (aucune dépendance Prisma) : les scores prix/délai sont relatifs
 * au meilleur candidat de la consultation (100 = le moins cher / le plus rapide,
 * proportionnel ensuite). Le score qualité vient du fournisseur (note globale ou
 * taux de conformité déjà calculé ailleurs, cf. app/api/logistique/fournisseurs/[id]) ;
 * s'il est inconnu, un score neutre est appliqué pour ne pas pénaliser injustement
 * un fournisseur sans historique.
 */

export const POIDS_PRIX = 0.45;
export const POIDS_DELAI = 0.30;
export const POIDS_QUALITE = 0.25;
export const SCORE_QUALITE_NEUTRE = 50;

export interface CandidatRFQ {
  fournisseurId: number;
  prixUnitaire: number;
  delaiLivraisonJours: number;
  /** 0-100, null si le fournisseur n'a pas encore d'historique évalué. */
  scoreQualite: number | null;
}

export interface CandidatNote extends CandidatRFQ {
  scorePrix: number;
  scoreDelai: number;
  scoreQualiteEffectif: number;
  scoreGlobal: number;
  rangPrix: number;
  rangDelai: number;
  rangGlobal: number;
}

/**
 * Calcule le comparatif (scores + rangs) et trie du meilleur au moins bon
 * candidat (score global décroissant). Le premier élément est la recommandation.
 */
export function comparerCandidatsRFQ(candidats: CandidatRFQ[]): CandidatNote[] {
  if (candidats.length === 0) return [];

  const prixMin  = Math.min(...candidats.map((c) => c.prixUnitaire));
  const delaiMin = Math.min(...candidats.map((c) => c.delaiLivraisonJours));

  const notes: CandidatNote[] = candidats.map((c) => {
    const scorePrix  = c.prixUnitaire > 0 ? Math.round((prixMin / c.prixUnitaire) * 100) : 100;
    const scoreDelai = c.delaiLivraisonJours > 0 ? Math.round((delaiMin / c.delaiLivraisonJours) * 100) : 100;
    const scoreQualiteEffectif = c.scoreQualite ?? SCORE_QUALITE_NEUTRE;
    const scoreGlobal = Math.round(
      scorePrix * POIDS_PRIX + scoreDelai * POIDS_DELAI + scoreQualiteEffectif * POIDS_QUALITE
    );
    return { ...c, scorePrix, scoreDelai, scoreQualiteEffectif, scoreGlobal, rangPrix: 0, rangDelai: 0, rangGlobal: 0 };
  });

  const byPrix = [...notes].sort((a, b) => a.prixUnitaire - b.prixUnitaire);
  byPrix.forEach((c, i) => { c.rangPrix = i + 1; });

  const byDelai = [...notes].sort((a, b) => a.delaiLivraisonJours - b.delaiLivraisonJours);
  byDelai.forEach((c, i) => { c.rangDelai = i + 1; });

  const byGlobal = [...notes].sort((a, b) => b.scoreGlobal - a.scoreGlobal);
  byGlobal.forEach((c, i) => { c.rangGlobal = i + 1; });

  return byGlobal;
}

/** Le meilleur candidat (recommandation système), ou null si aucune cotation. */
export function meilleurCandidat(notes: CandidatNote[]): CandidatNote | null {
  return notes.length > 0 ? notes[0] : null;
}
