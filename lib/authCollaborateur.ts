import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Retourne la session si l'utilisateur est un gestionnaire avec un ProfilRH (collaborateur OGRH).
 * Admin et SuperAdmin sont aussi acceptés (pour les tests).
 */
export async function getCollaborateurSession() {
  const session = await getAuthSession();
  if (!session) return null;

  const role  = session.user.role;
  const gRole = session.user.gestionnaireRole;

  if (role === "ADMIN" || role === "SUPER_ADMIN") return session;
  if (!gRole) return null;

  // Doit avoir un ProfilRH actif
  const profil = await prisma.profilRH.findFirst({
    where: { gestionnaire: { member: { id: parseInt(session.user.id) } } },
    select: { id: true },
  });
  if (!profil) return null;

  return session;
}

/**
 * Retourne le ProfilRH de l'utilisateur connecté, ou null s'il n'en a pas.
 */
export async function getCollaborateurProfilRH(userId: number) {
  return prisma.profilRH.findFirst({
    where:  { gestionnaire: { member: { id: userId } } },
    select: { id: true, matricule: true, configHoraireId: true },
  });
}
