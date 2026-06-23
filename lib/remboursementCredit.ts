import type { Prisma } from "@prisma/client";

type TX = Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

/**
 * Valide le N° de jour d'un encaissement journalier (1..dureeJours du crédit).
 * Retourne un message d'erreur ou null si valide / absent (champ optionnel).
 */
export function validerNumeroJour(numeroJour: number | null | undefined, dureeJours: number): string | null {
  if (numeroJour === null || numeroJour === undefined) return null;
  if (!Number.isInteger(numeroJour) || numeroJour < 1 || numeroJour > dureeJours) {
    return `N° de jour invalide (doit être compris entre 1 et ${dureeJours}).`;
  }
  return null;
}

/**
 * Montant attendu = montant restant de l'échéance correspondant au N° de jour
 * (calcul automatique, autorité serveur). Retourne null si pas de N° de jour ou
 * d'échéance correspondante.
 */
export async function montantAttenduDuJour(
  tx: TX,
  creditId: number,
  numeroJour: number | null | undefined,
): Promise<number | null> {
  if (numeroJour === null || numeroJour === undefined) return null;
  const echeance = await tx.echeanceCredit.findFirst({
    where: { creditId, numeroEcheance: numeroJour },
    select: { montantDu: true, montantPaye: true },
  });
  if (!echeance) return null;
  return Math.max(0, Number(echeance.montantDu) - Number(echeance.montantPaye));
}

/**
 * Parse une date de collecte fournie par le client (ISO ou yyyy-mm-dd).
 * Retourne `undefined` si absente/invalide → laisse le défaut Prisma (now()).
 */
export function parseDateCollecte(value: unknown): Date | undefined {
  if (!value || typeof value !== "string") return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}
