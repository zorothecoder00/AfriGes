import { prisma } from "@/lib/prisma";

/**
 * Clôture automatiquement toutes les sessions EN_COURS dont la dateCollecte
 * est antérieure à aujourd'hui (minuit).
 *
 * - CollecteJournaliere → statut VALIDEE
 * - LigneCollecte encore EN_ATTENTE → statut ECHEC (agent ne s'est pas présenté)
 *
 * @param agentId  Si fourni, limite la clôture aux sessions de cet agent uniquement.
 * @returns        Nombre de sessions clôturées.
 */
export async function autoCloseOldSessions(agentId?: number): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const sessions = await prisma.collecteJournaliere.findMany({
    where: {
      statut: "EN_COURS",
      dateCollecte: { lt: todayStart },
      ...(agentId !== undefined ? { agentId } : {}),
    },
    select: { id: true },
  });

  if (sessions.length === 0) return 0;

  const ids = sessions.map((s) => s.id);
  const now = new Date();

  await prisma.$transaction([
    // Fermer les sessions
    prisma.collecteJournaliere.updateMany({
      where: { id: { in: ids } },
      data: { statut: "VALIDEE", dateValidation: now },
    }),
    // Lignes non collectées → ECHEC
    prisma.ligneCollecte.updateMany({
      where: { collecteId: { in: ids }, statut: "EN_ATTENTE" },
      data: { statut: "ECHEC" },
    }),
  ]);

  return sessions.length;
}
