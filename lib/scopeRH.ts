import { prisma } from "@/lib/prisma";

export interface RHScope {
  isAdmin: boolean;
  /** null = aucune restriction (admin) ; sinon liste des profilRH accessibles (collaborateurs du PDV du RH) */
  profilRHIds: number[] | null;
}

/**
 * Calcule le périmètre RH d'une session :
 *   - ADMIN / SUPER_ADMIN → aucune restriction (profilRHIds = null)
 *   - RESPONSABLE_RH avec PDV actif → tous les collaborateurs de son PDV
 *   - RESPONSABLE_RH sans PDV → uniquement son propre profil (repli)
 *
 * Mutualise la logique utilisée par les routes /api/responsableRH/paie/*.
 */
export async function getRHScope(session: {
  user: { id: string; role?: string | null };
}): Promise<RHScope> {
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "");
  if (isAdmin) return { isAdmin: true, profilRHIds: null };

  const meId = parseInt(session.user.id);

  const affectation = await prisma.gestionnaireAffectation.findFirst({
    where:  { userId: meId, actif: true },
    select: { pointDeVenteId: true },
  });

  let memberIds: number[];
  if (affectation) {
    const pdvUsers = await prisma.gestionnaireAffectation.findMany({
      where:  { pointDeVenteId: affectation.pointDeVenteId, actif: true },
      select: { userId: true },
    });
    memberIds = pdvUsers.map((u) => u.userId);
  } else {
    memberIds = [meId];
  }

  const profils = await prisma.profilRH.findMany({
    where:  { gestionnaire: { memberId: { in: memberIds } } },
    select: { id: true },
  });

  return { isAdmin: false, profilRHIds: profils.map((p) => p.id) };
}

/** Vrai si le profilRHId est dans le périmètre (toujours vrai pour l'admin). */
export function profilDansPerimetre(scope: RHScope, profilRHId: number): boolean {
  return scope.profilRHIds === null || scope.profilRHIds.includes(profilRHId);
}
