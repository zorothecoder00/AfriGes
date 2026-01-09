import { prisma } from "@/lib/prisma";
import { StatutTontine } from "@prisma/client";

export async function getDashboardUser(userId: number) {
  /**
   * 1️⃣ Récupération du wallet de l’utilisateur
   */
  const wallet = await prisma.wallet.findUnique({
    where: {
      memberId: userId,
    },
    select: {
      soldeGeneral: true,
      soldeTontine: true,
      soldeCredit: true,
    },
  });

  /**
   * 2️⃣ Nombre de tontines actives de l’utilisateur
   * (tontines où il est membre ET statut ACTIVE)
   */
  const tontinesActives = await prisma.tontineMembre.count({
    where: {
      memberId: userId,
      tontine: {
        statut: StatutTontine.ACTIVE,
      },
    },
  });

  return {
    soldeGeneral: wallet?.soldeGeneral ?? 0,
    soldeTontine: wallet?.soldeTontine ?? 0,
    soldeCredit: wallet?.soldeCredit ?? 0,
    tontinesActives,
  };
}
