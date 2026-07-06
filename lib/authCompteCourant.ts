// lib/authCompteCourant.ts
// Contrôle d'accès du module Compte Courant (CDC §17).
//
// Mapping des rôles du CDC → rôles système :
//   Administrateur    → Role ADMIN / SUPER_ADMIN (accès total)
//   Directeur         → RoleGestionnaire RESPONSABLE_ECONOMIQUE (validation)
//   Chef d'agence     → CHEF_AGENCE (validation agence + création)
//   Caissier          → CAISSIER (dépôt + création ; retrait après validation)
//   Agent recouvreur  → AGENT_TERRAIN (consultation)
//   Auditeur          → AUDITEUR_INTERNE (lecture seule)

import { getAuthSession } from "@/lib/auth";
import type { Role, RoleGestionnaire } from "@prisma/client";

export type CCCapability =
  | "READ"      // consultation, recherche, détail, relevés
  | "CREATE"    // ouvrir un compte
  | "DEPOSIT"   // enregistrer un dépôt / initier un retrait
  | "VALIDATE"  // valider un retrait, suspendre/clôturer
  | "CONFIG";   // modifier le paramétrage général

/** Capacités par rôle gestionnaire (hors admin, traité à part). */
const CAPS_GESTIONNAIRE: Partial<Record<RoleGestionnaire, CCCapability[]>> = {
  CHEF_AGENCE:            ["READ", "CREATE", "DEPOSIT", "VALIDATE"],
  RESPONSABLE_ECONOMIQUE: ["READ", "VALIDATE"],
  CAISSIER:               ["READ", "CREATE", "DEPOSIT"],
  AGENT_TERRAIN:          ["READ"],
  AUDITEUR_INTERNE:       ["READ"],
};

/** Ensemble des capacités CC pour un couple (role, gestionnaireRole). */
export function ccCapabilities(
  role: Role | null | undefined,
  gestionnaireRole: RoleGestionnaire | null | undefined,
): Set<CCCapability> {
  // Admin système = accès total
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return new Set<CCCapability>(["READ", "CREATE", "DEPOSIT", "VALIDATE", "CONFIG"]);
  }
  const caps = gestionnaireRole ? CAPS_GESTIONNAIRE[gestionnaireRole] : undefined;
  return new Set<CCCapability>(caps ?? []);
}

/**
 * Renvoie la session si l'utilisateur possède la capacité demandée sur le
 * module Compte Courant, sinon null (→ 403 côté endpoint).
 */
export async function getCompteCourantSession(required: CCCapability) {
  const session = await getAuthSession();
  if (!session) return null;
  const caps = ccCapabilities(session.user.role, session.user.gestionnaireRole);
  return caps.has(required) ? session : null;
}
