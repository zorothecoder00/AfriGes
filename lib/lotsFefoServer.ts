import { prisma } from "@/lib/prisma";

/**
 * Tâches lots & péremption nécessitant le client Prisma (Enterprise #5) —
 * SERVEUR uniquement. Séparé de `lib/lotsFefo.ts` (pur/client-safe).
 */

/**
 * Marque PERIME tous les lots ACTIFS dont la DLC est dépassée (tâche de balayage).
 * Journalise un mouvement PEREMPTION par lot. Renvoie le nombre de lots traités.
 */
export async function marquerLotsPerimes(now: Date = new Date()): Promise<number> {
  const perimes = await prisma.lotProduit.findMany({
    where: { statut: "ACTIF", dlc: { lt: now } },
    select: { id: true, quantite: true },
  });
  if (perimes.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    for (const lot of perimes) {
      await tx.lotProduit.update({ where: { id: lot.id }, data: { statut: "PERIME" } });
      if (lot.quantite > 0) {
        await tx.mouvementLot.create({ data: { lotId: lot.id, type: "PEREMPTION", quantite: lot.quantite, motif: "Péremption automatique (DLC dépassée)" } });
      }
    }
  });
  return perimes.length;
}
