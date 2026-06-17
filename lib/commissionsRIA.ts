import type { TypeCommissionRIA } from "@prisma/client";

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
