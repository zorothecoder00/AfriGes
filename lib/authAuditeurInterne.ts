import { getAuthSession } from "@/lib/auth";

/**
 * Vérifie que l'utilisateur est un auditeur interne (ou admin).
 * Retourne la session si OK, null sinon.
 */
export async function getAuditeurInterneSession() {
  const session = await getAuthSession();
  if (!session) return null;
  const role = session.user.role;
  const gRole = session.user.gestionnaireRole;
  if (
    role === "ADMIN" ||
    role === "SUPER_ADMIN" ||
    gRole === "AUDITEUR_INTERNE"
  ) {
    return session;
  }
  return null;
}
