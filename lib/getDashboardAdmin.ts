import { prisma } from "@/lib/prisma";
import { MemberStatus, StatutTontine, StatutCredit } from "@prisma/client";

export async function getDashboardAdmin() {
  /**
   * 1️⃣ Membres actifs
   */
  const membresActifs = await prisma.user.count({
    where: {
      etat: MemberStatus.ACTIF,
    },
  });

  /**
   * 2️⃣ Tontines actives
   */
  const tontinesActives = await prisma.tontine.count({
    where: {
      statut: StatutTontine.ACTIVE,
    },
  });

  /**
   * 3️⃣ Crédits en cours
   * (non totalement remboursés)
   */
  const creditsEnCours = await prisma.credit.count({
    where: {
      statut: {
        in: [
          StatutCredit.EN_ATTENTE,
          StatutCredit.APPROUVE,
          StatutCredit.REMBOURSE_PARTIEL,
        ],
      },
    },
  });

  /**
   * 4️⃣ Achats via crédits alimentaires
   */
  const achatsCreditAlimentaire = await prisma.venteCreditAlimentaire.aggregate({
    _count: {
      id: true,
    },
    _sum: {
      prixUnitaire: true,
    },
  });

  return {
    membresActifs,
    tontinesActives,
    creditsEnCours,
    achatsCreditAlimentaire: {
      nombreAchats: achatsCreditAlimentaire._count.id ?? 0,
      montantTotal: achatsCreditAlimentaire._sum.prixUnitaire ?? 0,
    },
  };
}
