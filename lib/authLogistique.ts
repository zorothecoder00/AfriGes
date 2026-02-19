import { getAuthSession } from "@/lib/auth";

/**
 * Vérifie que l'utilisateur connecté est un agent logistique d'approvisionnement.
 * Retourne la session si OK, null sinon.
 */
export async function getLogistiqueSession() {
  const session = await getAuthSession();
  if (!session) return null;
  if (session.user.gestionnaireRole !== "AGENT_LOGISTIQUE_APPROVISIONNEMENT") return null;
  return session;
}
