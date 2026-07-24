/**
 * lib/paieCotisations.ts — Cotisation sociale CNSS + retenue IRPP (Togo), automatiques.
 *
 * ── CNSS ──────────────────────────────────────────────────────────────────
 * Taux légaux (fournis par l'utilisateur, 2026-07-24) :
 *   - Total CNSS : 21,50 % du salaire brut
 *   - Part salariale (retenue sur le net) : 4 %
 *   - Part patronale (charge employeur, non déduite du net) : 17,50 %
 *
 * La part salariale est injectée comme ComposantSalaire retenue à la création
 * de la fiche (cf. lib/creerFichePaie.ts), sur la base du salaire brut total
 * (totalBrut = salaire de base + primes/commissions/gains). La part patronale
 * n'est pas un composant de la fiche (elle ne réduit pas le net à payer) ; elle
 * est calculée à la volée pour l'État CNSS/fiscal (cf. app/api/admin/rh/paie/cnss-fiscal).
 *
 * ── IRPP ──────────────────────────────────────────────────────────────────
 * Barème progressif annuel officiel (CGI Togo art. 74, fourni par l'utilisateur
 * le 2026-07-24). Revenu imposable = totalBrut - CNSS salariale (4 %). Calcul
 * mensuel par annualisation (×12 puis barème annuel puis ÷12) — méthode
 * standard de retenue à la source pour un salaire mensuel stable.
 *
 * Quotient familial (fourni par l'utilisateur, 2026-07-24) : 1 part pour une
 * personne seule, 1,5 part pour un couple marié sans enfant, +0,5 part par
 * enfant à charge dans la limite de 6 enfants (plafond = 4,5 parts pour les
 * enfants, donc 6 parts max au total pour un couple marié). Le barème
 * s'applique jusqu'à la majorité de l'enfant ou 28 ans pour un étudiant — non
 * vérifiable ici faute de champ « âge/statut étudiant » en base : nbEnfants
 * est utilisé tel quel. Base « mariée » (1,5 part) appliquée uniquement à
 * SituationMatrimoniale.MARIE ; CELIBATAIRE/DIVORCE/VEUF/UNION_LIBRE → 1 part
 * (règle non précisée par l'utilisateur pour ces cas, choix par défaut).
 *
 * Simplification assumée (à corriger si l'utilisateur précise) :
 *   - Indemnités exonérées (transport, logement…) non déduites de la base
 *     imposable faute de barème de plafonds — toute la base non-CNSS reste
 *     imposable (choix conservateur : sur-estime légèrement l'impôt plutôt
 *     que de risquer une sous-déclaration).
 */

export const TAUX_CNSS_SALARIAL = 0.04;
export const TAUX_CNSS_PATRONAL = 0.175;
export const TAUX_CNSS_TOTAL    = 0.215;

export interface ComposantCotisation {
  type: "COTISATION_RETRAITE" | "IMPOT_REVENU";
  libelle: string;
  montant: number;
  isRetenue: true;
  ordre: number;
}

/** Retenue CNSS salariale (4 % du brut), à injecter comme ComposantSalaire retenue. */
export function calculerCotisationCnssSalariale(totalBrut: number): ComposantCotisation {
  const montant = Math.round(totalBrut * TAUX_CNSS_SALARIAL);
  return {
    type:      "COTISATION_RETRAITE",
    libelle:   "Cotisation CNSS salariale (4 %)",
    montant,
    isRetenue: true,
    ordre:     85,
  };
}

/** Part patronale CNSS (17,50 % du brut) — charge employeur, calculée pour l'état CNSS/fiscal. */
export function calculerCotisationCnssPatronale(totalBrut: number): number {
  return Math.round(totalBrut * TAUX_CNSS_PATRONAL);
}

/** Barème IRPP annuel (Togo, CGI art. 74) — tranches marginales, bornes en FCFA. */
const BAREME_IRPP_ANNUEL: { plafond: number | null; taux: number }[] = [
  { plafond: 900_000,     taux: 0 },
  { plafond: 3_000_000,   taux: 0.03 },
  { plafond: 6_000_000,   taux: 0.10 },
  { plafond: 9_000_000,   taux: 0.15 },
  { plafond: 12_000_000,  taux: 0.20 },
  { plafond: 15_000_000,  taux: 0.25 },
  { plafond: null,        taux: 0.35 },
];

/** Applique le barème progressif par tranches à un revenu annuel imposable. */
export function calculerImpotAnnuel(revenuAnnuelImposable: number): number {
  let impot = 0;
  let borneInf = 0;
  for (const tranche of BAREME_IRPP_ANNUEL) {
    const borneSup = tranche.plafond ?? Infinity;
    if (revenuAnnuelImposable <= borneInf) break;
    const montantDansTranche = Math.min(revenuAnnuelImposable, borneSup) - borneInf;
    if (montantDansTranche > 0) impot += montantDansTranche * tranche.taux;
    borneInf = borneSup;
  }
  return impot;
}

/**
 * Nombre de parts fiscales (quotient familial) à partir de la situation
 * matrimoniale et du nombre d'enfants à charge (ProfilRH).
 */
export function calculerNombreParts(situationMatrimoniale: string | null | undefined, nbEnfants: number): number {
  const partBase    = situationMatrimoniale === "MARIE" ? 1.5 : 1;
  const partEnfants = Math.min(Math.max(nbEnfants, 0), 6) * 0.5;
  return partBase + partEnfants;
}

/**
 * Retenue IRPP mensuelle, à injecter comme ComposantSalaire retenue.
 * `cnssSalariale` : montant déjà calculé par calculerCotisationCnssSalariale,
 * déduit du brut avant application du barème (revenu net imposable).
 * `nombreParts` : quotient familial (cf. calculerNombreParts) — défaut 1 part.
 */
export function calculerCotisationIrpp(totalBrut: number, cnssSalariale: number, nombreParts = 1): ComposantCotisation {
  const revenuMensuelImposable = Math.max(0, totalBrut - cnssSalariale);
  const revenuAnnuelImposable  = revenuMensuelImposable * 12;
  const revenuParPart = revenuAnnuelImposable / nombreParts;
  const impotAnnuel   = calculerImpotAnnuel(revenuParPart) * nombreParts;
  const montant = Math.round(impotAnnuel / 12);
  return {
    type:      "IMPOT_REVENU",
    libelle:   `Impôt sur le revenu (IRPP, ${nombreParts} part${nombreParts > 1 ? "s" : ""})`,
    montant,
    isRetenue: true,
    ordre:     87,
  };
}
