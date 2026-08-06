// lib/permissionsRegistry.ts
// Catalogue central du RBAC granulaire : les 6 actions, les modules protégés, et
// la matrice de permissions par défaut par rôle gestionnaire.
//
// Modèle de résolution (cf. lib/permissions.ts) :
//   défaut registry  →  override rôle (RolePermission)  →  override utilisateur (UserPermission)
// L'admin/superadmin possède tout, sans passer par la matrice.
//
// Module "comptabilite" (CDC comptabilité §43) : entrées enregistrées ici pour
// que la matrice reflète les 9 rôles du CDC, mais PAS ENCORE branchées comme
// garde d'accès sur `app/api/comptable/**` (celles-ci restent gated par
// lib/authComptable.ts::getComptableSession — binaire COMPTABLE/CHEF_COMPTABLE/
// ADMIN). L'enforcement fin route par route reste un chantier à part (déjà
// noté comme tel pour les autres modules avant celui-ci).

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
  { key: "factures",       label: "Factures" },
  { key: "comptabilite",   label: "Comptabilité générale" },
  { key: "marketing",      label: "Marketing" },
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
    stock: ROE, ventes: ROE, caisse: ROE, rh: RO, paie: RO, marketing: RO,
  },
  RESPONSABLE_ECONOMIQUE: {
    credits: [L, V, E], compte_courant: [L, V, E], ventes: ROE, caisse: ROE, stock: ROE, paie: ROE,
  },
  CAISSIER: {
    caisse: RW, ventes: [L, C, E], compte_courant: [L, C, E], credits: [L, S], stock: RO, factures: [L, S],
  },
  RESPONSABLE_VENTE_CREDIT: {
    credits: FULL, compte_courant: RO, ventes: ROE, factures: [L, E, S],
  },
  AGENT_TERRAIN: {
    credits: [L, C], ventes: [L, C], compte_courant: ROE,
  },
  COMPTABLE: {
    caisse: ROE, ventes: ROE, credits: ROE, compte_courant: ROE, paie: ROE, stock: ROE,
    comptabilite: [L, C, M, V, E],
  },
  // CDC comptabilité §43 — "Chef comptable" (saisie + contrôle + validation,
  // séparation des fonctions §44) : parité d'accès module comptable avec
  // COMPTABLE (voir lib/authComptable.ts::getComptableSession, qui accepte
  // aussi ce rôle) + droit de suppression logique réservé à ce niveau.
  CHEF_COMPTABLE: {
    caisse: ROE, ventes: ROE, credits: ROE, compte_courant: ROE, paie: ROE, stock: ROE,
    comptabilite: FULL,
  },
  // CDC §43 — "Directeur / Gérant" (consultation globale + validation selon
  // autorisation) : lecture large + validation, jamais de saisie/suppression.
  DIRECTEUR_GENERAL: {
    caisse: ROE, ventes: ROE, credits: ROE, compte_courant: ROE, paie: ROE, stock: ROE, rh: ROE,
    comptabilite: [L, V, E], marketing: FULL,
  },
  // CDC §43 — "Responsable achats" (achats + consultation comptable limitée).
  RESPONSABLE_ACHATS: {
    stock: [L, C, M, E],
    comptabilite: RO,
  },
  // CDC §43 — "Investisseur / actionnaire" : uniquement tableaux de bord
  // financiers autorisés (lecture seule, jamais de saisie).
  ACTIONNAIRE: {
    comptabilite: RO,
  },
  MAGAZINIER: {
    stock: [L, C, M, E, S],
  },
  AGENT_LOGISTIQUE_APPROVISIONNEMENT: {
    stock: [L, C, M, E],
  },
  RESPONSABLE_POINT_DE_VENTE: {
    ventes: RW, caisse: ROE, stock: [L, M, E], credits: RO, compte_courant: RO, marketing: RO,
  },
  RESPONSABLE_RH: {
    rh: FULL, paie: [L, C, M, V, E],
  },
  AUDITEUR_INTERNE: {
    credits: ROE, compte_courant: ROE, rh: ROE, paie: ROE, stock: ROE, ventes: ROE, caisse: ROE,
    comptabilite: ROE,
  },
  // Module Marketing (Phase 1) — accès complet à son périmètre.
  RESPONSABLE_MARKETING: {
    marketing: FULL, ventes: RO, credits: RO, stock: RO,
  },
};

/** Actions autorisées par défaut pour (rôle, module), avant overrides DB. */
export function defaultActions(role: string | null | undefined, moduleKey: string): PermissionAction[] {
  if (!role) return [];
  return DEFAULT_MATRIX[role]?.[moduleKey] ?? [];
}
