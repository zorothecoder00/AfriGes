// lib/comptabilite/analytique.ts
//
// Comptabilité analytique (CDC §24) et comparaison budget/réalisé (CDC §25).
// Le "réalisé" ne compte que les écritures VALIDE/CLOTURE — jamais un brouillon
// non contrôlé — dans le sens naturel du compte (débiteur ou créditeur).
import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

export async function calculerRealiseCompte(
  tx: TxClient,
  params: { compteId: number; annee: number; mois?: number; sectionAnalytiqueId?: number; pointDeVenteId?: number },
): Promise<number> {
  const compte = await tx.compteComptable.findUnique({ where: { id: params.compteId }, select: { sens: true } });
  if (!compte) return 0;

  const dateDebut = new Date(params.annee, params.mois ? params.mois - 1 : 0, 1);
  const dateFin = params.mois ? new Date(params.annee, params.mois, 1) : new Date(params.annee + 1, 0, 1);

  const agg = await tx.ligneEcriture.aggregate({
    where: {
      compteId: params.compteId,
      ...(params.sectionAnalytiqueId != null && { sectionAnalytiqueId: params.sectionAnalytiqueId }),
      ...(params.pointDeVenteId != null && { pointDeVenteId: params.pointDeVenteId }),
      ecriture: { statut: { in: ["VALIDE", "CLOTURE"] }, date: { gte: dateDebut, lt: dateFin } },
    },
    _sum: { debit: true, credit: true },
  });

  const totalDebit = Number(agg._sum.debit ?? 0);
  const totalCredit = Number(agg._sum.credit ?? 0);
  return compte.sens === "CREDITEUR" ? totalCredit - totalDebit : totalDebit - totalCredit;
}
