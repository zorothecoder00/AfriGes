import { prisma } from "@/lib/prisma";

/**
 * Produits de substitution (Catalogue Ent.#4) — résolution SERVEUR.
 * Quand un produit est en rupture au point de vente, propose ses équivalents
 * réellement disponibles sur CE point de vente (stock net > 0, produit ACTIF),
 * triés par priorité. Tient compte des liens bidirectionnels.
 */

export interface SubstitutDispo {
  id: number;
  nom: string;
  codeProduit: string | null;
  prixUnitaire: number;
  stockDispo: number;
  priorite: number;
}

/**
 * Équivalents disponibles pour `produitId` sur `pointDeVenteId`.
 * Renvoie `[]` si aucun substitut configuré ou aucun en stock.
 */
export async function substitutsDisponibles(
  produitId: number,
  pointDeVenteId: number | null | undefined,
): Promise<SubstitutDispo[]> {
  if (!pointDeVenteId) return [];

  // Liens directs (produitId → substitutId) + inverses bidirectionnels.
  const liens = await prisma.produitSubstitut.findMany({
    where: {
      OR: [
        { produitId },
        { substitutId: produitId, bidirectionnel: true },
      ],
    },
    select: { produitId: true, substitutId: true, priorite: true },
  });
  if (liens.length === 0) return [];

  // L'équivalent est l'« autre » produit du lien. Garde la priorité la plus haute.
  const prioriteParId = new Map<number, number>();
  for (const l of liens) {
    const equivId = l.produitId === produitId ? l.substitutId : l.produitId;
    if (equivId === produitId) continue;
    prioriteParId.set(equivId, Math.max(prioriteParId.get(equivId) ?? 0, l.priorite));
  }
  const ids = [...prioriteParId.keys()];
  if (ids.length === 0) return [];

  // Stock net (quantite - quantiteReservee) sur ce PDV + infos produit.
  const stocks = await prisma.stockSite.findMany({
    where: { produitId: { in: ids }, pointDeVenteId },
    select: {
      produitId: true, quantite: true, quantiteReservee: true,
      produit: { select: { id: true, nom: true, codeProduit: true, prixUnitaire: true, statut: true } },
    },
  });

  const out: SubstitutDispo[] = [];
  for (const s of stocks) {
    const dispo = s.quantite - s.quantiteReservee;
    if (dispo <= 0 || s.produit.statut !== "ACTIF") continue;
    out.push({
      id: s.produit.id,
      nom: s.produit.nom,
      codeProduit: s.produit.codeProduit,
      prixUnitaire: Number(s.produit.prixUnitaire),
      stockDispo: dispo,
      priorite: prioriteParId.get(s.produitId) ?? 0,
    });
  }
  out.sort((a, b) => b.priorite - a.priorite || b.stockDispo - a.stockDispo);
  return out;
}
