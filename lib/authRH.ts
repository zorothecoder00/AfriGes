import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RHSession = NonNullable<Awaited<ReturnType<typeof getAuthSession>>>;

/**
 * Vérifie que l'utilisateur est un Responsable RH ou un admin.
 */
export async function getRHSession() {
  const session = await getAuthSession();
  if (!session) return null;
  const role  = session.user.role;
  const gRole = session.user.gestionnaireRole;
  if (
    role  === "ADMIN"       ||
    role  === "SUPER_ADMIN" ||
    gRole === "RESPONSABLE_RH"
  ) {
    return session;
  }
  return null;
}

/**
 * Indique si la session a accès à un profil RH donné selon son périmètre PDV.
 *
 * - ADMIN / SUPER_ADMIN : accès total (true).
 * - RESPONSABLE_RH : accès uniquement aux profils des collaborateurs de son PDV
 *   (via GestionnaireAffectation) ; à défaut de PDV affecté, à ses propres profils.
 *
 * Logique alignée sur le scoping de GET /api/responsableRH/paie.
 */
export async function profilRHDansPerimetre(
  session: RHSession,
  profilRHId: number,
): Promise<boolean> {
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "");
  if (isAdmin) return true;

  const meId = parseInt(session.user.id);
  const affectation = await prisma.gestionnaireAffectation.findFirst({
    where:  { userId: meId, actif: true },
    select: { pointDeVenteId: true },
  });

  let pdvUserIds: number[];
  if (affectation) {
    const pdvUsers = await prisma.gestionnaireAffectation.findMany({
      where:  { pointDeVenteId: affectation.pointDeVenteId, actif: true },
      select: { userId: true },
    });
    pdvUserIds = pdvUsers.map((u) => u.userId);
  } else {
    // Aucun PDV affecté → limité à ses propres profils
    pdvUserIds = [meId];
  }

  const profil = await prisma.profilRH.findFirst({
    where:  { id: profilRHId, gestionnaire: { memberId: { in: pdvUserIds } } },
    select: { id: true },
  });
  return !!profil;
}
