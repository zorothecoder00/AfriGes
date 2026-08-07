import type { TypeOperationTerrain } from "@prisma/client";

/**
 * Opérations marketing terrain (CDC §41) — MODULE PUR (client-safe). Aucune
 * dépendance à `@/lib/prisma` : importé par des composants client
 * (components/marketing/OperationsTerrainMarketing.tsx) pour les libellés.
 * La validation (accès DB) vit dans lib/operationTerrainServer.ts.
 */

export const TYPES_OPERATION_TERRAIN: TypeOperationTerrain[] = [
  "STREET_MARKETING", "FLYERS", "PORTE_A_PORTE", "ANIMATION_MARCHE", "DEGUSTATION", "STAND", "CARAVANE", "AUTRE",
];

export const TYPE_OPERATION_TERRAIN_LABEL: Record<TypeOperationTerrain, string> = {
  STREET_MARKETING: "Street marketing",
  FLYERS: "Distribution de flyers",
  PORTE_A_PORTE: "Porte-à-porte",
  ANIMATION_MARCHE: "Animation marché",
  DEGUSTATION: "Dégustation",
  STAND: "Stand",
  CARAVANE: "Caravane",
  AUTRE: "Autre",
};
