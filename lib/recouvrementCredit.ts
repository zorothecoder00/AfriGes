import { TypeActionRecouvrement } from "@prisma/client";

/**
 * Recouvrement du crédit client classique (CDC digitalisation §5.4).
 * Helpers partagés entre les routes /api/admin/credits/[id]/recouvrement/*
 * et les composants d'impression (FicheActionRecouvrement).
 */

export const LABEL_TYPE_ACTION: Record<TypeActionRecouvrement, string> = {
  APPEL_TELEPHONIQUE: "Appel téléphonique",
  VISITE_TERRAIN: "Visite de recouvrement",
  MISE_EN_DEMEURE: "Mise en demeure",
  ACCORD_ECHEANCIER: "Accord sur échéancier",
  SAISIE_GARANTIE: "Saisie de garantie",
  NOTE_INTERNE: "Note interne",
};

/** Délai par défaut (jours) accordé au client dans une mise en demeure si non précisé. */
export const DELAI_MISE_EN_DEMEURE_DEFAUT = 8;

/** Rôles gestionnaires à notifier selon la gravité du type d'action loggé. */
export function rolesANotifier(type: TypeActionRecouvrement): { roles: string[]; haute: boolean } {
  switch (type) {
    case "MISE_EN_DEMEURE":
    case "SAISIE_GARANTIE":
      return { roles: ["RESPONSABLE_VENTE_CREDIT", "COMPTABLE"], haute: true };
    case "VISITE_TERRAIN":
    case "ACCORD_ECHEANCIER":
      return { roles: ["RESPONSABLE_VENTE_CREDIT"], haute: false };
    default:
      return { roles: [], haute: false };
  }
}
