import { getAuthSession } from "@/lib/auth";

/**
 * Vérifie que l'utilisateur est un caissier (ou admin).
 * Retourne la session si OK, null sinon.
 */
export async function getCaissierSession() {
  const session = await getAuthSession();
  if (!session) return null;
  const role = session.user.role;
  const gRole = session.user.gestionnaireRole;
  if (
    role === "ADMIN" ||
    role === "SUPER_ADMIN" ||
    gRole === "CAISSIER"
  ) {
    return session;
  }
  return null;
}
