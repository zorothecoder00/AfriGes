import { getAuthSession } from "@/lib/auth";

/**
 * Vérifie que l'utilisateur est un Responsable RH ou un admin.
 */
export async function getRHSession() {
  const session = await getAuthSession();
  if (!session) return null;
  const role  = session.user.role;
  const gRole = session.user.gestionnaireRole;
  if (
    role  === "ADMIN"       ||
    role  === "SUPER_ADMIN" ||
    gRole === "RESPONSABLE_RH"
  ) {
    return session;
  }
  return null;
}
