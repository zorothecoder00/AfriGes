import { getAuthSession } from "@/lib/auth";

/**
 * Vérifie que l'utilisateur connecté est un Responsable Marketing, un
 * Community Manager (CDC §31 — créateur de contenu, sans droit de
 * validation, cf. lib/permissionsRegistry.ts), un Admin ou un Super Admin.
 * Retourne la session si OK, null sinon.
 */
export async function getMarketingSession() {
  const session = await getAuthSession();
  if (!session) return null;
  const role  = session.user.role;
  const gRole = session.user.gestionnaireRole;
  if (
    role  === "ADMIN"                ||
    role  === "SUPER_ADMIN"          ||
    gRole === "RESPONSABLE_MARKETING" ||
    gRole === "COMMUNITY_MANAGER"    ||
    gRole === "DIRECTEUR_MARKETING"  ||
    gRole === "MARKETING_TERRAIN"    ||
    gRole === "DIRECTEUR_GENERAL"    ||
    gRole === "RESPONSABLE_POINT_DE_VENTE" ||
    gRole === "CHEF_AGENCE"
  ) {
    return session;
  }
  return null;
}

/**
 * CDC §31/§54/§79 — "Direction" = Admin/Super Admin OU le rôle gestionnaire
 * DIRECTEUR_GENERAL ("lecture globale + validation stratégique", déjà utilisé
 * en comptabilité pour la même notion). Un Directeur Général n'est pas
 * forcément Admin/SuperAdmin (compte gestionnaire USER + gestionnaireRole).
 */
export function estDirection(session: { user: { role?: string | null; gestionnaireRole?: string | null } }): boolean {
  return session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN" || session.user.gestionnaireRole === "DIRECTEUR_GENERAL";
}
