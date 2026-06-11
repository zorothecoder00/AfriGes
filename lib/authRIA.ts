import { getAuthSession } from "@/lib/auth";

export async function getRIASession() {
  const session = await getAuthSession();
  if (!session) return null;
  const role  = session.user.role;
  const gRole = session.user.gestionnaireRole;
  if (
    role  === "ADMIN"          ||
    role  === "SUPER_ADMIN"    ||
    gRole === "RESPONSABLE_RIA"
  ) {
    return session;
  }
  return null;
}
