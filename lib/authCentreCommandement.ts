import { getAuthSession } from "@/lib/auth";

/**
 * Centre de commandement documentaire (CDC digitalisation, catalogue Partie A
 * + Partie B) : Admin/Super Admin (accès total) + Responsable Point de Vente
 * / Chef d'agence (recherche scopée à leur(s) point(s) de vente, via
 * resolvePdvIdsAutorises réutilisé de lib/reclamationClientServer.ts).
 */
export async function getCentreCommandementSession() {
  const session = await getAuthSession();
  if (!session) return null;
  const role = session.user.role;
  const gRole = session.user.gestionnaireRole;
  if (
    role === "ADMIN" ||
    role === "SUPER_ADMIN" ||
    gRole === "RESPONSABLE_POINT_DE_VENTE" ||
    gRole === "CHEF_AGENCE"
  ) {
    return session;
  }
  return null;
}
