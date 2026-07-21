import { prisma } from "@/lib/prisma";

export type UserPdv = { id: number; nom: string; code: string };

/**
 * PDVs actifs rattachés à un utilisateur.
 * Source de vérité identique à /api/me/affectation :
 *   1. Affectations gestionnaire actives (CHEF_AGENCE / RESPONSABLE_COMMUNAUTE peuvent en avoir plusieurs)
 *   2. Fallback : l'utilisateur est le RPV d'un point de vente (PointDeVente.rpvId)
 *
 * Une liste vide signifie « non rattaché à un PDV » (ex. Admin / rôle transverse)
 * → accès réseau complet côté appelant.
 */
export async function resolveUserPdvs(userId: number): Promise<UserPdv[]> {
  const affs = await prisma.gestionnaireAffectation.findMany({
    where: { userId, actif: true },
    select: { pointDeVente: { select: { id: true, nom: true, code: true } } },
    orderBy: { dateDebut: "desc" },
  });
  const pdvs = affs.map((a) => a.pointDeVente).filter(Boolean) as UserPdv[];
  if (pdvs.length > 0) {
    // Dédoublonne (plusieurs affectations actives possibles vers le même PDV).
    return [...new Map(pdvs.map((p) => [p.id, p])).values()];
  }

  return prisma.pointDeVente.findMany({
    where: { rpvId: userId, actif: true },
    select: { id: true, nom: true, code: true },
  });
}
