import { Prisma } from "@prisma/client";

/**
 * Dépôt-vente (CDC digitalisation §5.5) — helpers partagés entre les routes
 * conventions/depots/reglements. Le stock déposé est tracé via LotProduit
 * (voir le commentaire de bloc dans prisma/schema.prisma juste avant
 * ConventionDepotVente pour le détail de la stratégie de réutilisation FEFO).
 */

type TX = Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

/** Génère une référence unique (préfixe-année-NNNNNN) avec retry sur conflit P2002. */
export async function genererReferenceUnique<T>(
  prefixe: string,
  compter: () => Promise<number>,
  creer: (reference: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const count = await compter();
    const annee = new Date().getFullYear();
    const reference = `${prefixe}-${annee}-${String(count + 1 + attempt).padStart(6, "0")}`;
    try {
      return await creer(reference);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  throw new Error("Impossible de générer une référence unique");
}

export interface LigneDepotAvecLot {
  id: number;
  produitId: number;
  quantiteDeposee: number;
  prixVenteConvenu: Prisma.Decimal | number;
  quantiteReprise: number;
  lotProduitId: number | null;
}

export interface SnapshotLigneDepot {
  ligneDepotId: number;
  produitId: number;
  quantiteInitiale: number;
  quantiteRestante: number;
  quantiteVendue: number;
  prixVenteConvenu: number;
  montantBrut: number;
}

/**
 * Quantité vendue d'une ligne de dépôt = quantiteInitiale du lot − quantite
 * restante du lot − quantité déjà reprise au fournisseur. Nécessite le lot
 * lié (lignes sans lotProduitId = dépôt pas encore entré en stock, ignorées).
 */
export async function snapshotLignesDepot(tx: TX, lignes: LigneDepotAvecLot[]): Promise<SnapshotLigneDepot[]> {
  const lotIds = lignes.map((l) => l.lotProduitId).filter((id): id is number => id != null);
  if (lotIds.length === 0) return [];
  const lots = await tx.lotProduit.findMany({ where: { id: { in: lotIds } }, select: { id: true, quantiteInitiale: true, quantite: true } });
  const lotParId = new Map(lots.map((l) => [l.id, l]));

  const out: SnapshotLigneDepot[] = [];
  for (const l of lignes) {
    if (l.lotProduitId == null) continue;
    const lot = lotParId.get(l.lotProduitId);
    if (!lot) continue;
    const quantiteVendue = Math.max(0, lot.quantiteInitiale - lot.quantite - l.quantiteReprise);
    const prixVenteConvenu = Number(l.prixVenteConvenu);
    out.push({
      ligneDepotId: l.id,
      produitId: l.produitId,
      quantiteInitiale: lot.quantiteInitiale,
      quantiteRestante: lot.quantite,
      quantiteVendue,
      prixVenteConvenu,
      montantBrut: quantiteVendue * prixVenteConvenu,
    });
  }
  return out;
}
