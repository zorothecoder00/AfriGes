import { getAuthSession } from "@/lib/auth";

/**
 * Vérifie que l'utilisateur connecté est un agent terrain ou un admin.
 * Retourne la session si OK, null sinon.
 */
export async function getAgentTerrainSession() {
  const session = await getAuthSession();
  if (!session) return null;
  const role  = session.user.role;
  const gRole = session.user.gestionnaireRole;
  if (
    role  === "ADMIN"       ||
    role  === "SUPER_ADMIN" ||
    gRole === "AGENT_TERRAIN"
  ) {
    return session;
  }
  return null;
}
