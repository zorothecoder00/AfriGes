import { getAuthSession } from "@/lib/auth";

/**
 * Vérifie que l'utilisateur est Directeur Commercial (ou admin).
 * Rôle cross-agence (Catalogue §21.B) : pas de restriction PDV, vue globale
 * sur le catalogue commercial (prix vente/crédit, promotions, marges,
 * historique) — sans accès aux paramètres système ni à la comptabilité.
 * Retourne la session si OK, null sinon.
 */
export async function getDirecteurCommercialSession() {
  const session = await getAuthSession();
  if (!session) return null;
  const role = session.user.role;
  const gRole = session.user.gestionnaireRole;
  if (
    role === "ADMIN" ||
    role === "SUPER_ADMIN" ||
    gRole === "DIRECTEUR_COMMERCIAL"
  ) {
    return session;
  }
  return null;
}
