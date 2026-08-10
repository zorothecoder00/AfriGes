import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type TxOrPrisma = Prisma.TransactionClient | typeof prisma;

/**
 * Double casquette Chef Agence / Responsable Point de Vente (sharedAdminPaths,
 * proxy.ts) sur /dashboard/admin/marketing : accès pensé pour "les campagnes
 * de son agence" — jamais l'ensemble du réseau. Résout la liste des PDV
 * auxquels un utilisateur marketing a droit de regard :
 *   - null   → aucune restriction (profils marketing globaux : Admin, Super
 *              Admin, Responsable/Directeur Marketing, Directeur Général,
 *              Marketing terrain, Community Manager).
 *   - Int[]  → restreint à ces PDV (peut être vide si le rôle n'a pas de PDV
 *              rattaché, ex. RPV sans point de vente configuré).
 */
export async function resoudrePdvIdsAutorises(
  session: { user: { id: string | number; gestionnaireRole?: string | null } },
  client: TxOrPrisma = prisma,
): Promise<number[] | null> {
  const gestRole = session.user.gestionnaireRole;
  const userId = Number(session.user.id);

  if (gestRole === "RESPONSABLE_POINT_DE_VENTE") {
    const pdv = await client.pointDeVente.findUnique({ where: { rpvId: userId }, select: { id: true } });
    return pdv ? [pdv.id] : [];
  }
  if (gestRole === "CHEF_AGENCE") {
    const pdvs = await client.pointDeVente.findMany({ where: { chefAgenceId: userId }, select: { id: true } });
    return pdvs.map((p) => p.id);
  }
  return null;
}
