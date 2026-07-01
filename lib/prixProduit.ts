/**
 * lib/prixProduit.ts — Traçabilité des prix produits (achat & vente).
 *
 * À chaque changement de prix (création, édition manuelle, approvisionnement),
 * on enregistre une entrée `HistoriquePrixProduit` : un SNAPSHOT des deux prix
 * effectifs à partir de `dateEffet`, même si un seul a changé. On peut ainsi
 * retrouver le prix appliqué à n'importe quelle date, tracer qui a modifié quoi,
 * et figer la marge du moment (transparence).
 *
 * Le prix courant reste sur `Produit.prixUnitaire` (vente) et `Produit.prixAchat`
 * (achat) — ce helper NE modifie PAS le produit, il ne fait que journaliser.
 * Les appelants mettent à jour le produit eux-mêmes (comportement inchangé).
 *
 * Usage typique dans une transaction Prisma :
 *   await enregistrerChangementPrix(tx, {
 *     produitId, nouveauPrixAchat: 1200, source: "APPRO",
 *     receptionApproId, userId, motif: "Réception REC-042",
 *   });
 */

import { Prisma, TypeChangementPrix } from "@prisma/client";
import type { TxClient } from "@/lib/notifications";

/** Convertit une valeur en Decimal, ou null si vide/absente. */
function toDecimal(v: unknown): Prisma.Decimal | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return new Prisma.Decimal(n);
}

function decEqual(a: Prisma.Decimal | null, b: Prisma.Decimal | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.equals(b);
}

export interface ChangementPrixInput {
  produitId: number;
  /** Nouveau prix de vente. `undefined` = inchangé. */
  nouveauPrixVente?: number | string | Prisma.Decimal | null;
  /** Nouveau prix d'achat. `undefined` = inchangé, `null`/"" = effacé. */
  nouveauPrixAchat?: number | string | Prisma.Decimal | null;
  /** Origine du changement : "MANUEL" (défaut), "APPRO", "INITIAL"… */
  source?: string;
  motif?: string;
  /** Réception d'appro à l'origine d'un changement de prix d'achat. */
  receptionApproId?: number;
  /** Utilisateur à l'origine du changement. */
  userId?: number;
  /** Date d'effet (défaut : maintenant). */
  dateEffet?: Date;
  /** Forcer une entrée INITIAL (création produit) même si un prix est nul. */
  initial?: boolean;
}

/**
 * Journalise un changement de prix s'il y a réellement une variation.
 * Retourne l'entrée créée, ou `null` si rien n'a changé (aucun bruit).
 *
 * IMPORTANT : appeler APRÈS avoir déterminé les prix courants du produit, ou
 * laisser ce helper les lire dans la transaction (il lit le produit pour
 * compléter le prix non fourni et détecter la variation réelle).
 */
export async function enregistrerChangementPrix(
  tx: TxClient,
  input: ChangementPrixInput,
) {
  const produit = await tx.produit.findUnique({
    where: { id: input.produitId },
    select: { prixUnitaire: true, prixAchat: true },
  });
  if (!produit) return null;

  const venteActuel = produit.prixUnitaire as Prisma.Decimal;
  const achatActuel = produit.prixAchat as Prisma.Decimal | null;

  // Nouveau snapshot : la valeur fournie, sinon la valeur courante conservée.
  const venteSnap =
    input.nouveauPrixVente !== undefined
      ? toDecimal(input.nouveauPrixVente) ?? venteActuel
      : venteActuel;
  const achatSnap =
    input.nouveauPrixAchat !== undefined
      ? toDecimal(input.nouveauPrixAchat)
      : achatActuel;

  const venteChange =
    input.nouveauPrixVente !== undefined && !decEqual(venteSnap, venteActuel);
  const achatChange =
    input.nouveauPrixAchat !== undefined && !decEqual(achatSnap, achatActuel);

  // Rien n'a bougé et ce n'est pas une création → on n'enregistre pas.
  if (!input.initial && !venteChange && !achatChange) return null;

  let type: TypeChangementPrix;
  if (input.initial) type = TypeChangementPrix.INITIAL;
  else if (venteChange && achatChange) type = TypeChangementPrix.LES_DEUX;
  else if (achatChange) type = TypeChangementPrix.ACHAT;
  else type = TypeChangementPrix.VENTE;

  const marge = achatSnap !== null ? venteSnap.minus(achatSnap) : null;

  return tx.historiquePrixProduit.create({
    data: {
      produitId:        input.produitId,
      prixVente:        venteSnap,
      prixAchat:        achatSnap,
      marge,
      type,
      source:           input.source ?? (input.initial ? "INITIAL" : "MANUEL"),
      motif:            input.motif ?? null,
      receptionApproId: input.receptionApproId ?? null,
      creeParId:        input.userId ?? null,
      dateEffet:        input.dateEffet ?? new Date(),
    },
  });
}

/**
 * Calcule la marge (valeur + taux) à partir d'un prix d'achat et de vente.
 * Taux de marge = (vente - achat) / achat * 100 (marge sur coût), cohérent avec
 * l'affichage historique de l'application. Renvoie null si achat absent/nul.
 */
export function calculerMarge(
  prixVente: number | null | undefined,
  prixAchat: number | null | undefined,
): { valeur: number; taux: number } | null {
  if (prixVente == null || prixAchat == null || prixAchat <= 0) return null;
  const valeur = prixVente - prixAchat;
  return { valeur, taux: (valeur / prixAchat) * 100 };
}
