import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Vérifie que l'utilisateur est un comptable (ou admin).
 * Retourne la session si OK, null sinon.
 */
export async function getComptableSession() {
  const session = await getAuthSession();
  if (!session) return null;
  const role = session.user.role;
  const gRole = session.user.gestionnaireRole;
  if (
    role === "ADMIN" ||
    role === "SUPER_ADMIN" ||
    gRole === "COMPTABLE"
  ) {
    return session;
  }
  return null;
}

/**
 * Retourne l'ID du PDV auquel le comptable est affecté (affectation active).
 * Retourne null pour les admins (pas de restriction PDV → vue globale).
 * Si viewAsUserId est fourni (admin en mode lecture), retourne le PDV du user ciblé.
 * Retourne null si le comptable n'a aucune affectation active (fallback global).
 */
export async function getComptablePdvId(
  session: NonNullable<Awaited<ReturnType<typeof getComptableSession>>>,
  viewAsUserId?: number
): Promise<number | null> {
  const role = session.user.role;
  if ((role === "ADMIN" || role === "SUPER_ADMIN") && viewAsUserId !== undefined) {
    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: viewAsUserId, actif: true },
      select: { pointDeVenteId: true },
    });
    return aff?.pointDeVenteId ?? null;
  }
  if (role === "ADMIN" || role === "SUPER_ADMIN") return null;

  const affectation = await prisma.gestionnaireAffectation.findFirst({
    where: { userId: Number(session.user.id), actif: true },
    select: { pointDeVenteId: true },
  });
  return affectation?.pointDeVenteId ?? null;
}
