import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Vérifie que l'utilisateur est un caissier (ou admin).
 * Retourne la session si OK, null sinon.
 */
export async function getCaissierSession() {
  const session = await getAuthSession();
  if (!session) return null;
  const role = session.user.role;
  const gRole = session.user.gestionnaireRole;
  if (
    role === "ADMIN" ||
    role === "SUPER_ADMIN" ||
    gRole === "CAISSIER"
  ) {
    return session;
  }
  return null;
}

/**
 * Retourne le pointDeVenteId actif du caissier via son affectation.
 * Retourne null si le caissier n'est pas affecté à un PDV.
 */
export async function getCaissierPdvId(userId: number): Promise<number | null> {
  const aff = await prisma.gestionnaireAffectation.findFirst({
    where: { userId, actif: true },
    select: { pointDeVenteId: true },
  });
  return aff?.pointDeVenteId ?? null;
}

/**
 * Construit le filtre Prisma pour restreindre les souscriptions au PDV du caissier.
 */
export function souscriptionPdvWhere(pdvId: number) {
  return {
    OR: [
      { client: { pointDeVenteId: pdvId } },
      { user: { affectationsPDV: { some: { pointDeVenteId: pdvId, actif: true } } } },
    ],
  };
}
