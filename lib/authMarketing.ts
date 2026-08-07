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
    gRole === "COMMUNITY_MANAGER"
  ) {
    return session;
  }
  return null;
}

/** CDC §31 — "Direction" = Admin/Super Admin uniquement (2e palier de validation). */
export function estDirection(session: { user: { role?: string | null } }): boolean {
  return session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
}
