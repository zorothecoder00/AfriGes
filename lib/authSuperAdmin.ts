import { getAuthSession } from "@/lib/auth";

/**
 * Vérifie que l'utilisateur est SUPER_ADMIN.
 * Les ADMIN n'ont pas accès — réservé au Super-Administrateur uniquement.
 */
export async function getSuperAdminSession() {
  const session = await getAuthSession();
  if (!session) return null;
  if (session.user.role === "SUPER_ADMIN") return session;
  return null;
}
