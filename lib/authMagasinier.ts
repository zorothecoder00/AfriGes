import { getAuthSession } from "@/lib/auth";

/**
 * Vérifie que l'utilisateur connecté est un magasinier ou un admin.
 * Retourne la session si OK, null sinon.
 */
export async function getMagasinierSession() {
  const session = await getAuthSession();
  if (!session) return null;
  const role  = session.user.role;
  const gRole = session.user.gestionnaireRole;
  if (
    role  === "ADMIN"       ||
    role  === "SUPER_ADMIN" ||
    gRole === "MAGAZINIER"
  ) {
    return session;
  }
  return null;
}
