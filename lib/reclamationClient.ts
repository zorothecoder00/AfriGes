import { TypeActionReclamation, TypeReclamation, StatutRetourMarchandise, StatutRemplacementProduit } from "@prisma/client";

/**
 * Retours et réclamations client (CDC digitalisation §5.8). Lib PURE (aucun
 * import Prisma) : importée aussi bien par les routes API que par les
 * composants d'impression "use client" (FormulaireReclamation,
 * FicheRetourMarchandise, BonRemplacement, RapportIncidentCommercial,
 * FicheTraitementReclamation) et la page admin. La frontière client/serveur
 * Prisma est câblée à part dans lib/reclamationClientServer.ts
 * (resolvePdvIdsAutorises).
 */

export const LABEL_TYPE_RECLAMATION: Record<TypeReclamation, string> = {
  PRODUIT_DEFECTUEUX: "Produit défectueux",
  LIVRAISON_NON_CONFORME: "Livraison non conforme",
  ERREUR_FACTURATION: "Erreur de facturation",
  RETARD_LIVRAISON: "Retard de livraison",
  QUALITE_SERVICE: "Qualité de service",
  AUTRE: "Autre",
};

export const LABEL_TYPE_ACTION_RECLAMATION: Record<TypeActionReclamation, string> = {
  PRISE_EN_CHARGE: "Prise en charge",
  INVESTIGATION: "Investigation",
  RETOUR_ORGANISE: "Retour organisé",
  REMPLACEMENT_ORGANISE: "Remplacement organisé",
  AVOIR_EMIS: "Avoir émis",
  DECISION: "Décision",
  REJET: "Rejet",
  CLOTURE: "Clôture",
  NOTE_INTERNE: "Note interne",
};

export const LABEL_STATUT_RETOUR: Record<StatutRetourMarchandise, string> = {
  DECLARE: "Déclaré",
  RECEPTIONNE: "Réceptionné",
  VALIDE: "Validé (bon de retour)",
  REJETE: "Rejeté",
};

export const LABEL_STATUT_REMPLACEMENT: Record<StatutRemplacementProduit, string> = {
  DEMANDE: "Demandé",
  APPROUVE: "Approuvé",
  LIVRE: "Livré",
  REJETE: "Rejeté",
};

/** Rôles gestionnaires à notifier selon le type d'action de traitement loggé. */
export function rolesANotifierAction(type: TypeActionReclamation): { roles: string[]; haute: boolean } {
  switch (type) {
    case "REJET":
      return { roles: ["RESPONSABLE_POINT_DE_VENTE", "CHEF_AGENCE"], haute: true };
    case "CLOTURE":
    case "AVOIR_EMIS":
      return { roles: ["RESPONSABLE_POINT_DE_VENTE", "COMPTABLE"], haute: false };
    case "RETOUR_ORGANISE":
    case "REMPLACEMENT_ORGANISE":
      return { roles: ["RESPONSABLE_POINT_DE_VENTE", "MAGAZINIER"], haute: false };
    default:
      return { roles: ["RESPONSABLE_POINT_DE_VENTE"], haute: false };
  }
}
