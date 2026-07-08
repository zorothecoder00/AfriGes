// lib/permissionsRegistry.ts
// Catalogue central du RBAC granulaire : les 6 actions, les modules protégés, et
// la matrice de permissions par défaut par rôle gestionnaire.
//
// Modèle de résolution (cf. lib/permissions.ts) :
//   défaut registry  →  override rôle (RolePermission)  →  override utilisateur (UserPermission)
// L'admin/superadmin possède tout, sans passer par la matrice.

/** Les 6 actions granulaires exigées (administration système). */
export const PERMISSION_ACTIONS = [
  "LECTURE",
  "CREATION",
  "MODIFICATION",
  "VALIDATION",
  "EXPORT",
  "SUPPRESSION_LOGIQUE",
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const ACTION_LABEL: Record<PermissionAction, string> = {
  LECTURE:             "Lecture",
  CREATION:            "Création",
  MODIFICATION:        "Modification",
  VALIDATION:          "Validation",
  EXPORT:              "Export",
  SUPPRESSION_LOGIQUE: "Suppression logique",
};

/** Modules protégés par le RBAC granulaire. `key` sert de clé en base. */
export type PermissionModule = { key: string; label: string };

export const PERMISSION_MODULES: PermissionModule[] = [
  { key: "credits",        label: "Crédits clients" },
  { key: "compte_courant", label: "Comptes courants" },
  { key: "rh",             label: "Ressources humaines" },
  { key: "paie",           label: "Paie" },
  { key: "stock",          label: "Stock" },
  { key: "ventes",         label: "Ventes" },
  { key: "caisse",         label: "Caisse" },
];

export const MODULE_KEYS = PERMISSION_MODULES.map((m) => m.key);

/** Raccourcis de lisibilité pour la matrice ci-dessous. */
const L = "LECTURE", C = "CREATION", M = "MODIFICATION", V = "VALIDATION", E = "EXPORT", S = "SUPPRESSION_LOGIQUE";
const RW: PermissionAction[] = [L, C, M, E];        // lecture + écriture courante
const RO: PermissionAction[] = [L];                 // lecture seule
const ROE: PermissionAction[] = [L, E];             // lecture + export (audit, compta)
const FULL: PermissionAction[] = [L, C, M, V, E, S]; // toutes les actions

/**
 * Matrice par défaut : pour un rôle gestionnaire donné, les actions autorisées
 * par module. Approxime le comportement actuel (codé en dur) ; le superadmin peut
 * ensuite tout ajuster via l'UI. Un module absent = aucune action (tout refusé).
 */
export const DEFAULT_MATRIX: Record<string, Partial<Record<string, PermissionAction[]>>> = {
  CHEF_AGENCE: {
    credits: [L, C, M, V, E], compte_courant: [L, C, M, V, E],
    stock: ROE, ventes: ROE, caisse: ROE, rh: RO, paie: RO,
  },
  RESPONSABLE_ECONOMIQUE: {
    credits: [L, V, E], compte_courant: [L, V, E], ventes: ROE, caisse: ROE, stock: ROE, paie: ROE,
  },
  CAISSIER: {
    caisse: RW, ventes: [L, C, E], compte_courant: [L, C, E], credits: RO, stock: RO,
  },
  RESPONSABLE_VENTE_CREDIT: {
    credits: FULL, compte_courant: RO, ventes: ROE,
  },
  AGENT_TERRAIN: {
    credits: [L, C], ventes: [L, C], compte_courant: ROE,
  },
  COMPTABLE: {
    caisse: ROE, ventes: ROE, credits: ROE, compte_courant: ROE, paie: ROE, stock: ROE,
  },
  MAGAZINIER: {
    stock: [L, C, M, E, S],
  },
  AGENT_LOGISTIQUE_APPROVISIONNEMENT: {
    stock: [L, C, M, E],
  },
  RESPONSABLE_POINT_DE_VENTE: {
    ventes: RW, caisse: ROE, stock: [L, M, E], credits: RO, compte_courant: RO,
  },
  RESPONSABLE_RH: {
    rh: FULL, paie: [L, C, M, V, E],
  },
  AUDITEUR_INTERNE: {
    credits: ROE, compte_courant: ROE, rh: ROE, paie: ROE, stock: ROE, ventes: ROE, caisse: ROE,
  },
};

/** Actions autorisées par défaut pour (rôle, module), avant overrides DB. */
export function defaultActions(role: string | null | undefined, moduleKey: string): PermissionAction[] {
  if (!role) return [];
  return DEFAULT_MATRIX[role]?.[moduleKey] ?? [];
}
