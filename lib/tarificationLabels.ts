import type { TypePrix } from "@prisma/client";

/**
 * Libellés & liste des types de prix (Catalogue §4) — MODULE PUR (client-safe).
 * Extrait de `lib/tarification.ts` (qui importe Prisma) pour pouvoir être
 * importé depuis des composants client sans embarquer le client Prisma.
 */

export const TYPES_PRIX = [
  "ACHAT", "FOURNISSEUR", "REVIENT", "GROS", "DETAIL", "COMMUNAUTE", "VIP",
  "PROMOTION", "PERSONNEL", "PARTENAIRE", "REVENDEUR", "CREDIT", "NOUVEAU_CLIENT", "FIDELE",
] as const;

export const TYPE_PRIX_LABEL: Record<TypePrix, string> = {
  ACHAT: "Prix d'achat", FOURNISSEUR: "Prix fournisseur", REVIENT: "Prix de revient",
  GROS: "Prix de gros", DETAIL: "Prix de détail (comptant)", COMMUNAUTE: "Prix Communauté",
  VIP: "Prix VIP", PROMOTION: "Prix promotion", PERSONNEL: "Prix personnel",
  PARTENAIRE: "Prix partenaire", REVENDEUR: "Prix revendeur", CREDIT: "Prix crédit",
  NOUVEAU_CLIENT: "Prix nouveau client", FIDELE: "Prix fidèle",
};
