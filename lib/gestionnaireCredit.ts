import { prisma } from "@/lib/prisma";
import { RoleGestionnaire } from "@prisma/client";

/**
 * Résout le RVC (Responsable Vente Crédit) actif rattaché à un point de vente.
 * Sert de repli pour le « gestionnaire du crédit » sur le bordereau lorsque
 * aucun gestionnaire n'a été choisi manuellement.
 */
export async function resolveRvcPdv(pointDeVenteId: number | null | undefined) {
  if (!pointDeVenteId) return null;
  const aff = await prisma.gestionnaireAffectation.findFirst({
    where: {
      pointDeVenteId,
      actif: true,
      user: { gestionnaire: { role: RoleGestionnaire.RESPONSABLE_VENTE_CREDIT, actif: true } },
    },
    orderBy: { dateDebut: "desc" },
    select: { user: { select: { nom: true, prenom: true } } },
  });
  return aff?.user ?? null;
}
