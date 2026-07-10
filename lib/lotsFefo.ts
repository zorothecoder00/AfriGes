import type { Prisma } from "@prisma/client";

/**
 * Lots & péremption (Enterprise #5) — logique FEFO (First Expired, First Out).
 * MODULE PUR (client-safe) : types, labels, `etatPeremption` et `consommerFEFO`
 * (qui opère sur un `tx` fourni) — aucun import de `@/lib/prisma`. La tâche de
 * balayage `marquerLotsPerimes` (qui utilise le client Prisma) vit dans
 * `lib/lotsFefoServer.ts`.
 */

export type TxClient = Prisma.TransactionClient;

export const SEUIL_PEREMPTION_JOURS = 30; // en deçà → alerte « bientôt périmé »

export type EtatPeremption = "SANS_DLC" | "OK" | "BIENTOT" | "PERIME";

export const ETAT_PEREMPTION_LABEL: Record<EtatPeremption, string> = {
  SANS_DLC: "Sans date", OK: "Valide", BIENTOT: "Bientôt périmé", PERIME: "Périmé",
};

/** État de péremption d'une DLC + nombre de jours restants (négatif si dépassé). */
export function etatPeremption(
  dlc: Date | string | null | undefined,
  seuilJours = SEUIL_PEREMPTION_JOURS,
  now: Date = new Date(),
): { etat: EtatPeremption; joursRestants: number | null } {
  if (!dlc) return { etat: "SANS_DLC", joursRestants: null };
  const d = new Date(dlc);
  const joursRestants = Math.floor((d.getTime() - now.getTime()) / 86400000);
  if (joursRestants < 0) return { etat: "PERIME", joursRestants };
  if (joursRestants <= seuilJours) return { etat: "BIENTOT", joursRestants };
  return { etat: "OK", joursRestants };
}

export interface AllocationLot {
  lotId: number;
  numeroLot: string;
  quantite: number;
}

/**
 * Déstocke `quantite` unités d'un produit sur un site en suivant le FEFO : on
 * pioche dans les lots ACTIFS par DLC croissante (les lots sans DLC en dernier),
 * on décrémente et on marque EPUISE ceux tombés à 0, en journalisant chaque
 * sortie. Lève une erreur si le total des lots est insuffisant.
 *
 * ⚠️ À appeler dans une transaction (`tx`). Ne touche PAS à StockSite (le stock
 * agrégé reste géré par le flux de stock existant) : les lots sont une couche de
 * traçabilité de péremption superposée.
 */
export async function consommerFEFO(
  tx: TxClient,
  args: { produitId: number; pointDeVenteId: number; quantite: number; operateurId?: number | null; motif?: string },
): Promise<AllocationLot[]> {
  const { produitId, pointDeVenteId, quantite, operateurId, motif } = args;
  if (quantite <= 0) return [];

  const lots = await tx.lotProduit.findMany({
    where: { produitId, pointDeVenteId, statut: "ACTIF", quantite: { gt: 0 } },
    orderBy: [{ dlc: { sort: "asc", nulls: "last" } }, { dateReception: "asc" }],
    select: { id: true, numeroLot: true, quantite: true },
  });

  const totalDispo = lots.reduce((s, l) => s + l.quantite, 0);
  if (totalDispo < quantite) {
    throw new Error(`Stock par lots insuffisant (${totalDispo} disponible, ${quantite} demandé)`);
  }

  const allocations: AllocationLot[] = [];
  let reste = quantite;
  for (const lot of lots) {
    if (reste <= 0) break;
    const pris = Math.min(reste, lot.quantite);
    const nouvelleQte = lot.quantite - pris;
    await tx.lotProduit.update({
      where: { id: lot.id },
      data: { quantite: nouvelleQte, ...(nouvelleQte === 0 ? { statut: "EPUISE" } : {}) },
    });
    await tx.mouvementLot.create({
      data: { lotId: lot.id, type: "SORTIE", quantite: pris, motif: motif ?? "Déstockage FEFO", operateurId: operateurId ?? null },
    });
    allocations.push({ lotId: lot.id, numeroLot: lot.numeroLot, quantite: pris });
    reste -= pris;
  }
  return allocations;
}
