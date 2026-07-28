import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

/** Normalise une paire d'utilisateurs : le plus petit ID est toujours "A" (garantit l'unicité de la conversation quel que soit qui écrit en premier). */
export function normaliserPaire(userId1: number, userId2: number): { utilisateurAId: number; utilisateurBId: number } {
  return userId1 < userId2
    ? { utilisateurAId: userId1, utilisateurBId: userId2 }
    : { utilisateurAId: userId2, utilisateurBId: userId1 };
}

/** Récupère la conversation entre deux utilisateurs, ou la crée si elle n'existe pas encore. */
export async function getOrCreateConversation(tx: TxClient, userId1: number, userId2: number) {
  const { utilisateurAId, utilisateurBId } = normaliserPaire(userId1, userId2);
  return tx.conversation.upsert({
    where: { utilisateurAId_utilisateurBId: { utilisateurAId, utilisateurBId } },
    update: {},
    create: { utilisateurAId, utilisateurBId },
  });
}
