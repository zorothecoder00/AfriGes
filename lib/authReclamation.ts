import { getAuthSession } from "@/lib/auth";

/**
 * Vérifie que l'utilisateur connecté peut gérer les réclamations et retours
 * clients (CDC digitalisation §5.8) : Admin, ou "Service Commercial" côté
 * agence (RPV / Chef d'agence), seuls rôles porteurs de la relation client
 * commerciale dans AfriGes aujourd'hui.
 * Retourne la session si OK, null sinon.
 */
export async function getReclamationSession() {
  const session = await getAuthSession();
  if (!session) return null;
  const role  = session.user.role;
  const gRole = session.user.gestionnaireRole;
  if (
    role  === "ADMIN"                   ||
    role  === "SUPER_ADMIN"             ||
    gRole === "RESPONSABLE_POINT_DE_VENTE" ||
    gRole === "CHEF_AGENCE"
  ) {
    return session;
  }
  return null;
}
