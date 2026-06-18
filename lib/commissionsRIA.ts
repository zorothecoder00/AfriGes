import type { TypeCommissionRIA, TypeDossierIC } from "@prisma/client";

/**
 * Source unique de vérité pour la correspondance entre :
 *  - le slug d'URL (route dynamique `[type]`, ex: "operations-terrain")
 *  - l'enum Prisma `TypeCommissionRIA` (ex: "OPERATIONS_TERRAIN")
 *
 * ⚠️ L'enum réel côté base est `AUDIT` (et non `AUDIT_CONTROLE`). Le slug
 * d'URL reste `audit-controle` pour la lisibilité, mais il pointe vers `AUDIT`.
 */
export const COMMISSION_SLUGS = [
  "finance",
  "operations-terrain",
  "audit-controle",
  "optimisation",
] as const;

export type CommissionSlug = (typeof COMMISSION_SLUGS)[number];

export const SLUG_TO_ENUM: Record<CommissionSlug, TypeCommissionRIA> = {
  "finance":            "FINANCE",
  "operations-terrain": "OPERATIONS_TERRAIN",
  "audit-controle":     "AUDIT",
  "optimisation":       "OPTIMISATION",
};

export const ENUM_TO_SLUG: Record<TypeCommissionRIA, CommissionSlug> = {
  FINANCE:            "finance",
  OPERATIONS_TERRAIN: "operations-terrain",
  AUDIT:              "audit-controle",
  OPTIMISATION:       "optimisation",
};

export const COMMISSION_LABELS: Record<TypeCommissionRIA, string> = {
  FINANCE:            "Commission Finance",
  OPERATIONS_TERRAIN: "Commission Opérations Terrain & Approvisionnement",
  AUDIT:              "Commission Audit & Contrôle Interne",
  OPTIMISATION:       "Commission Optimisation des Processus",
};

/** Slug d'URL → enum Prisma (null si slug inconnu). */
export function slugToEnum(slug: string): TypeCommissionRIA | null {
  return SLUG_TO_ENUM[slug as CommissionSlug] ?? null;
}

/** Enum Prisma → slug d'URL. */
export function enumToSlug(type: TypeCommissionRIA): CommissionSlug {
  return ENUM_TO_SLUG[type];
}

/** Libellé lisible à partir de l'enum (fallback sur la valeur brute). */
export function commissionLabel(type: TypeCommissionRIA | string): string {
  return COMMISSION_LABELS[type as TypeCommissionRIA] ?? String(type);
}

// ── Structure officielle d'une commission ────────────────────────────────────
// Chaque commission comporte exactement 3 postes : Président, Rapporteur 1,
// Rapporteur 2. (L'enum Prisma RoleMembreCommissionRIA contient d'anciennes
// valeurs — VICE_PRESIDENT, SECRETAIRE, TRESORIER, MEMBRE — qui ne sont plus
// proposées dans l'interface.)
export const COMMISSION_ROLES = ["PRESIDENT", "RAPPORTEUR_1", "RAPPORTEUR_2"] as const;
export type CommissionRole = (typeof COMMISSION_ROLES)[number];

export const COMMISSION_ROLE_LABELS: Record<string, string> = {
  PRESIDENT:    "Président(e)",
  RAPPORTEUR_1: "Rapporteur 1",
  RAPPORTEUR_2: "Rapporteur 2",
};

/** Pouvoirs associés à chaque poste (cahier des charges). */
export const COMMISSION_ROLE_POWERS: Record<CommissionRole, string[]> = {
  PRESIDENT: [
    "Convocation",
    "Validation des rapports",
    "Validation des recommandations",
    "Validation des résolutions",
    "Attribution des tâches",
    "Signature électronique",
  ],
  RAPPORTEUR_1: [
    "Préparation des dossiers",
    "Analyse",
    "Rédaction des rapports",
    "Préparation des réunions",
  ],
  RAPPORTEUR_2: [
    "Vérification des analyses",
    "Contrôle documentaire",
    "Co-rédaction des rapports",
    "Suivi des actions",
  ],
};

/** Libellé d'un poste (fallback sur la valeur brute pour d'éventuelles données héritées). */
export function roleLabel(role: string): string {
  return COMMISSION_ROLE_LABELS[role] ?? role;
}

// ── Routage inter-commissions imposé par le cahier des charges ────────────────
// Certains types de dossiers ont une trajectoire FIXE entre commissions et ne
// peuvent emprunter aucun autre chemin (Scénario 1 du CDC) :
//  - DEMANDE_FINANCEMENT : la Commission Opérations Terrain détecte le besoin et
//    transmet OBLIGATOIREMENT à la Commission Finance qui analyse et décide.
// Un type absent de cette table reste à routage libre (émettrice = une commission
// du créateur, réceptrice = une autre commission).
export const DOSSIER_ROUTAGE_FIXE: Partial<Record<TypeDossierIC, {
  emettrice: TypeCommissionRIA;
  receptrice: TypeCommissionRIA;
}>> = {
  DEMANDE_FINANCEMENT: { emettrice: "OPERATIONS_TERRAIN", receptrice: "FINANCE" },
};
