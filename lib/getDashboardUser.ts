import { prisma } from "@/lib/prisma";

export async function getDashboardUser(userId: number) {
  const wallet = await prisma.wallet.findUnique({
    where: { memberId: userId },
    select: {
      soldeGeneral: true,
      soldeTontine: true,
      soldeCredit: true,
    },
  });

  // Souscriptions de packs actives (remplace tontinesActives supprimé)
  const souscriptionsActives = await prisma.souscriptionPack.count({
    where: { userId, statut: "ACTIF" },
  });

  return {
    soldeGeneral:        wallet?.soldeGeneral ?? 0,
    soldeTontine:        wallet?.soldeTontine ?? 0,
    soldeCredit:         wallet?.soldeCredit ?? 0,
    souscriptionsActives,
  };
}
