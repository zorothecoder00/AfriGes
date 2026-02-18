import { getAuthSession } from "@/lib/auth";

/**
 * Vérifie que l'utilisateur connecté est un magasinier.
 * Retourne la session si OK, null sinon.
 */
export async function getMagasinierSession() {
  const session = await getAuthSession();
  if (!session) return null;
  if (session.user.gestionnaireRole !== "MAGAZINIER") return null;
  return session;
}
