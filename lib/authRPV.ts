import { getAuthSession } from "@/lib/auth";

/**
 * Vérifie que l'utilisateur est un Responsable Point de Vente (ou admin).
 * Le RPV a des droits étendus sur le stock, les livraisons et la supervision.
 */
export async function getRPVSession() {
  const session = await getAuthSession();
  if (!session) return null;
  const role  = session.user.role;
  const gRole = session.user.gestionnaireRole;
  if (
    role  === "ADMIN" ||
    role  === "SUPER_ADMIN" ||
    gRole === "RESPONSABLE_POINT_DE_VENTE"
  ) {
    return session;
  }
  return null;
}
