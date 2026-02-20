import { getAuthSession } from "@/lib/auth";

/**
 * Vérifie que l'utilisateur est un comptable (ou admin).
 * Retourne la session si OK, null sinon.
 */
export async function getComptableSession() {
  const session = await getAuthSession();
  if (!session) return null;
  const role = session.user.role;
  const gRole = session.user.gestionnaireRole;
  if (
    role === "ADMIN" ||
    role === "SUPER_ADMIN" ||
    gRole === "COMPTABLE"
  ) {
    return session;
  }
  return null;
}
