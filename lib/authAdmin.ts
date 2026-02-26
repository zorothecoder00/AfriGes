import { getAuthSession } from "@/lib/auth";

/**
 * Vérifie que l'utilisateur est ADMIN ou SUPER_ADMIN.
 */
export async function getAdminSession() {
  const session = await getAuthSession();
  if (!session) return null;
  const role = session.user.role;
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return session;
  }
  return null;
}
