import { getAuthSession } from "@/lib/auth";

/**
 * Vérifie que l'utilisateur connecté est un Responsable Marketing, un Admin
 * ou un Super Admin. Retourne la session si OK, null sinon.
 */
export async function getMarketingSession() {
  const session = await getAuthSession();
  if (!session) return null;
  const role  = session.user.role;
  const gRole = session.user.gestionnaireRole;
  if (
    role  === "ADMIN"                ||
    role  === "SUPER_ADMIN"          ||
    gRole === "RESPONSABLE_MARKETING"
  ) {
    return session;
  }
  return null;
}
