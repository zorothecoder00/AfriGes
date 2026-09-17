import { prisma } from "@/lib/prisma";

/**
 * Retours et réclamations client (CDC digitalisation §5.8) — partie SERVEUR
 * (importe Prisma). Séparée de lib/reclamationClient.ts pour ne jamais tirer
 * Prisma dans le bundle client via les composants d'impression qui importent
 * les libellés partagés.
 */

/**
 * Résout les points de vente auxquels une session getReclamationSession() a
 * accès : null = pas de restriction (admin), [] = aucun PDV rattaché.
 */
export async function resolvePdvIdsAutorises(session: {
  user: { id: string; role: string; gestionnaireRole?: string | null };
}): Promise<number[] | null> {
  const { role, gestionnaireRole: gRole } = session.user;
  if (role === "ADMIN" || role === "SUPER_ADMIN") return null;

  const userId = Number(session.user.id);
  if (gRole === "RESPONSABLE_POINT_DE_VENTE") {
    const pdv = await prisma.pointDeVente.findFirst({ where: { rpvId: userId }, select: { id: true } });
    return pdv ? [pdv.id] : [];
  }
  if (gRole === "CHEF_AGENCE") {
    const pdvs = await prisma.pointDeVente.findMany({ where: { chefAgenceId: userId, actif: true }, select: { id: true } });
    return pdvs.map((p) => p.id);
  }
  return [];
}
