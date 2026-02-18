import { getAuthSession } from "@/lib/auth";

/**
 * Vérifie que l'utilisateur connecté est un agent terrain.
 * Retourne la session si OK, null sinon.
 */
export async function getAgentTerrainSession() {
  const session = await getAuthSession();
  if (!session) return null;
  if (session.user.gestionnaireRole !== "AGENT_TERRAIN") return null;
  return session;
}
