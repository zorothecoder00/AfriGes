import { getAuthSession } from "@/lib/auth";

export async function getInvestisseurRIASession() {
  const session = await getAuthSession();
  if (!session) return null;
  const role  = session.user.role;
  const gRole = session.user.gestionnaireRole;
  if (
    role  === "ADMIN"          ||
    role  === "SUPER_ADMIN"    ||
    gRole === "INVESTISSEUR_RIA"
  ) {
    return session;
  }
  return null;
}
