// lib/clientTransaction.ts
// Grand livre auxiliaire du compte client (CDC digitalisation §5.2/§5.4,
// "Relevé de compte client") — chaque mouvement réel (remboursement crédit
// confirmé, versement pack payé, octroi d'un crédit) est journalisé ici.
// DEBIT = augmente ce que le client doit à AfriSime ; CREDIT = le réduit
// (paiement reçu). N'écrire que des mouvements à effet financier réel — un
// remboursement/versement EN_ATTENTE n'a pas encore d'effet, donc pas de ligne.

import { Prisma, TypeTransactionClient } from "@prisma/client";

type TX = Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export interface ParamsTransactionClient {
  clientId: number;
  type: TypeTransactionClient;
  montant: number;
  sens: "DEBIT" | "CREDIT";
  reference?: string | null;
  description?: string | null;
  sourceType: string;
  sourceId: number;
  agentId?: number | null;
  dateOperation?: Date;
}

export async function enregistrerTransactionClient(tx: TX, p: ParamsTransactionClient) {
  return tx.clientTransaction.create({
    data: {
      clientId: p.clientId,
      type: p.type,
      montant: p.montant,
      sens: p.sens,
      reference: p.reference ?? null,
      description: p.description ?? null,
      sourceType: p.sourceType,
      sourceId: p.sourceId,
      agentId: p.agentId ?? null,
      dateOperation: p.dateOperation ?? new Date(),
    },
  });
}

/** Aucune erreur si la ligne n'existe pas (ex. mouvement jamais confirmé) — no-op silencieux. */
export async function mettreAJourTransactionClient(
  tx: TX,
  source: { sourceType: string; sourceId: number },
  patch: { montant?: number; dateOperation?: Date; description?: string | null },
) {
  const existing = await tx.clientTransaction.findFirst({ where: source });
  if (!existing) return null;
  return tx.clientTransaction.update({ where: { id: existing.id }, data: patch });
}

export async function supprimerTransactionClient(tx: TX, source: { sourceType: string; sourceId: number }) {
  await tx.clientTransaction.deleteMany({ where: source });
}
