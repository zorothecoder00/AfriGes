import type { Prisma, PrismaClient } from "@prisma/client";

type TxClient = Prisma.TransactionClient;
type DbClient = PrismaClient | TxClient;

/**
 * Messagerie réservée aux gestionnaires (Admin/Super-admin ou profil Gestionnaire actif).
 * Les utilisateurs simples (rôle USER sans profil gestionnaire actif) n'y ont pas accès.
 */
export async function estAutoriseMessagerie(db: DbClient, userId: number): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, gestionnaire: { select: { actif: true } } },
  });
  if (!user) return false;
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return true;
  return user.gestionnaire?.actif === true;
}

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
