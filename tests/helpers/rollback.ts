// tests/helpers/rollback.ts
//
// CDC §78 — chaque test s'exécute dans sa propre transaction Prisma, toujours
// annulée en fin de test (succès ou échec), pour ne jamais laisser de résidu
// dans "afriges_test" sans avoir à truncate quoi que ce soit entre tests.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

class RollbackSentinel extends Error {}

export async function withRollback<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  let result: T | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      result = await fn(tx);
      throw new RollbackSentinel();
    });
  } catch (e) {
    if (!(e instanceof RollbackSentinel)) throw e;
  }
  return result as T;
}
