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

  return allouerLots(tx, lots, quantite, operateurId, motif);
}

/**
 * Variante **best-effort** de `consommerFEFO` pour brancher les lots au flux de
 * vente : ne lève JAMAIS. Si le produit n'a aucun lot sur le site, la couche FEFO
 * est simplement inactive (renvoie `[]`) et la vente suit son cours via StockSite.
 * Si des lots existent mais ne couvrent pas toute la quantité, on consomme ce qui
 * est disponible (traçabilité partielle) sans bloquer.
 */
export async function consommerFEFOBestEffort(
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
  if (lots.length === 0) return []; // produit non suivi par lots → couche FEFO inactive

  return allouerLots(tx, lots, quantite, operateurId, motif);
}

/** Pioche FEFO commune : décrémente les lots (déjà triés) et journalise les sorties. */
async function allouerLots(
  tx: TxClient,
  lots: { id: number; numeroLot: string; quantite: number }[],
  quantite: number,
  operateurId?: number | null,
  motif?: string,
): Promise<AllocationLot[]> {
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

/**
 * Crée (ou ré-alimente) un lot lors d'une réception d'approvisionnement
 * (Enterprise #5). Ne fait rien si aucune info lot/péremption n'est fournie
 * (produit non périssable). Si le numéro de lot existe déjà pour ce produit×site,
 * on cumule la quantité (même arrivage réceptionné en plusieurs fois) ; sinon on
 * crée le lot. Journalise un MouvementLot ENTREE. À appeler dans la transaction
 * de validation de la réception, après la mise en stock de la ligne.
 */
export async function creerLotDepuisReception(
  tx: TxClient,
  args: {
    produitId: number; pointDeVenteId: number; quantite: number;
    numeroLot?: string | null; dlc?: Date | null; dluo?: Date | null;
    prixAchat?: number | null; fournisseurId?: number | null;
    receptionApproId?: number | null; referenceReception: string; operateurId?: number | null;
  },
): Promise<number | null> {
  const { produitId, pointDeVenteId, quantite, numeroLot, dlc, dluo, prixAchat, fournisseurId, receptionApproId, referenceReception, operateurId } = args;
  // Pas de lot à tracer si ni numéro ni date de péremption (produit non suivi).
  if ((!numeroLot || !numeroLot.trim()) && !dlc && !dluo) return null;
  if (quantite <= 0) return null;

  // Numéro : celui saisi, sinon dérivé de la réception (garantit l'unicité + la traçabilité).
  const numero = numeroLot?.trim() || `${referenceReception}-P${produitId}`;

  const existant = await tx.lotProduit.findUnique({
    where: { produitId_pointDeVenteId_numeroLot: { produitId, pointDeVenteId, numeroLot: numero } },
    select: { id: true, quantite: true, quantiteInitiale: true },
  });

  if (existant) {
    await tx.lotProduit.update({
      where: { id: existant.id },
      data: { quantite: existant.quantite + quantite, quantiteInitiale: existant.quantiteInitiale + quantite, statut: "ACTIF" },
    });
    await tx.mouvementLot.create({
      data: { lotId: existant.id, type: "ENTREE", quantite, motif: `Réception ${referenceReception}`, operateurId: operateurId ?? null },
    });
    return existant.id;
  }

  const lot = await tx.lotProduit.create({
    data: {
      numeroLot: numero, produitId, pointDeVenteId,
      quantiteInitiale: quantite, quantite,
      dlc: dlc ?? null, dluo: dluo ?? null,
      prixAchat: prixAchat ?? null,
      fournisseurId: fournisseurId ?? null,
      receptionApproId: receptionApproId ?? null,
      creeParId: operateurId ?? null,
    },
    select: { id: true },
  });
  await tx.mouvementLot.create({
    data: { lotId: lot.id, type: "ENTREE", quantite, motif: `Réception ${referenceReception}`, operateurId: operateurId ?? null },
  });
  return lot.id;
}
