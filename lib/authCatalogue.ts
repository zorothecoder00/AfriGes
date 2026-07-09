import type { Role, RoleGestionnaire } from "@prisma/client";

/**
 * Contrôle d'accès du module Catalogue (Catalogue §15, §20).
 * La **validation d'un changement de prix** est réservée à :
 *   Admin / Super Admin, Chef d'agence, Responsable Marketing.
 */
export function peutValiderPrix(
  role: Role | null | undefined,
  gestionnaireRole: RoleGestionnaire | null | undefined,
): boolean {
  if (role === "ADMIN" || role === "SUPER_ADMIN") return true;
  return gestionnaireRole === "CHEF_AGENCE" || gestionnaireRole === "RESPONSABLE_MARKETING";
}

export const ROLES_VALIDATION_PRIX = "Administrateur, Chef d'agence ou Responsable Marketing";
