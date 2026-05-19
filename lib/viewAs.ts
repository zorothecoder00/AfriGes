/**
 * lib/viewAs.ts
 * Helper serveur pour le mode "Voir dashboard" (viewAs).
 *
 * L'admin clique "Voir dashboard" sur un gestionnaire → cookie `viewAs` posé
 * côté client + ?viewAs=userId injecté par useApi sur chaque GET.
 *
 * Dans les routes API :
 *   1. Valider la session admin via l'auth helper habituel
 *   2. Appeler resolveViewAs(req) pour obtenir le userId cible
 *   3. Utiliser cet userId pour le filtre PDV au lieu de l'userId admin
 */

export interface ViewAsInfo {
  /** ID du membre gestionnaire ciblé */
  userId: number;
}

/**
 * Parse ?viewAs=<userId> depuis l'URL de la requête.
 * Retourne null si absent ou invalide.
 *
 * SECURITE : à n'appeler qu'après avoir vérifié que la session est ADMIN/SUPER_ADMIN.
 */
export function resolveViewAs(req: Request | { url: string }): ViewAsInfo | null {
  try {
    const url = new URL(req.url);
    const raw = url.searchParams.get("viewAs");
    if (!raw) return null;
    const id = parseInt(raw, 10);
    if (isNaN(id) || id <= 0) return null;
    return { userId: id };
  } catch {
    return null;
  }
}

/**
 * Retourne le PDV actif d'un utilisateur gestionnaire (via GestionnaireAffectation).
 * Retourne null si aucune affectation active.
 */
export async function getPdvForUser(userId: number): Promise<number | null> {
  const { prisma } = await import("@/lib/prisma");
  const aff = await prisma.gestionnaireAffectation.findFirst({
    where: { userId, actif: true },
    select: { pointDeVenteId: true },
  });
  return aff?.pointDeVenteId ?? null;
}
