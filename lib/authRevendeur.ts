import { getAuthSession } from "@/lib/auth";

/**
 * Portail self-service du revendeur (CDC digitalisation §5.6) — strictement
 * réservé au compte du revendeur lui-même (rôle REVENDEUR), pas d'accès
 * Admin/RVC ici (eux passent par /api/admin/revendeurs/*, cf. getRVCSession
 * pour le crédit client classique).
 */
export async function getRevendeurSession() {
  const session = await getAuthSession();
  if (!session) return null;
  if (session.user.gestionnaireRole === "REVENDEUR") return session;
  return null;
}
