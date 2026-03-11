import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Vérifie que l'utilisateur est un Chef d'Agence (CHEF_AGENCE / RESPONSABLE_COMMUNAUTE)
 * ou un admin.  Retourne la session si OK, null sinon.
 */
export async function getChefAgenceSession() {
  const session = await getAuthSession();
  if (!session) return null;
  const role  = session.user.role;
  const gRole = session.user.gestionnaireRole;
  if (
    role  === "ADMIN" ||
    role  === "SUPER_ADMIN" ||
    gRole === "CHEF_AGENCE" ||
    gRole === "RESPONSABLE_COMMUNAUTE"
  ) {
    return session;
  }
  return null;
}

/**
 * Retourne les IDs des points de vente supervisés par ce chef d'agence.
 *  - Admin / SuperAdmin → null (vue globale, pas de restriction)
 *  - Chef d'agence      → tableau d'IDs des PDV ayant chefAgenceId = userId
 *                         (peut être [] si aucun PDV rattaché)
 */
export async function getChefAgencePdvIds(
  session: NonNullable<Awaited<ReturnType<typeof getChefAgenceSession>>>
): Promise<number[] | null> {
  const role = session.user.role;
  if (role === "ADMIN" || role === "SUPER_ADMIN") return null; // pas de restriction

  const userId = Number(session.user.id);
  const pdvs = await prisma.pointDeVente.findMany({
    where: { chefAgenceId: userId, actif: true },
    select: { id: true },
  });
  return pdvs.map((p) => p.id);
}
