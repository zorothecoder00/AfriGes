import type { Prisma } from "@prisma/client";

type TX = Prisma.TransactionClient;

/**
 * CDC §83 — émet un événement système (registre append-only, `EvenementSysteme`).
 * Pas de pub/sub temps réel : c'est un journal consultable/exploitable
 * ultérieurement par le moteur d'automatisation ou l'analytics, sans coupler
 * les modules entre eux. Câblé sur le périmètre marketing (campagnes/coupons/
 * fidélité) — cf. commentaire du modèle pour la limite assumée.
 */
export async function emitEvent(tx: TX, type: string, payload: Record<string, unknown>): Promise<void> {
  await tx.evenementSysteme.create({ data: { type, payload: payload as never } });
}
