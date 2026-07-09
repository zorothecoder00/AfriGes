/**
 * État de stock d'un produit sur un site (Catalogue §7) : code couleur et
 * libellé calculés à partir des quantités et des seuils. Réutilisable côté
 * serveur (API catalogue/disponibilité) et côté client (badges).
 *
 *  Rouge   : rupture (quantité ≤ 0) ou stock critique (≤ seuil critique).
 *  Orange  : faible (quantité ≤ stock minimum / seuil d'alerte).
 *  Vert    : disponible.
 */
export type NiveauStock = "RUPTURE" | "CRITIQUE" | "FAIBLE" | "DISPONIBLE";

export interface SeuilsStock {
  quantite: number;
  seuilCritique?: number | null;
  stockMin?: number | null;
  alerteStock?: number | null; // seuil d'alerte du site, ou fallback produit
}

export interface EtatStock {
  niveau: NiveauStock;
  couleur: "rouge" | "orange" | "vert";
  label: string;
}

export function etatStock(s: SeuilsStock): EtatStock {
  const q = Number(s.quantite) || 0;
  const critique = s.seuilCritique != null ? Number(s.seuilCritique) : null;
  const min = s.stockMin != null ? Number(s.stockMin) : (s.alerteStock != null ? Number(s.alerteStock) : null);

  if (q <= 0) return { niveau: "RUPTURE", couleur: "rouge", label: "Rupture" };
  if (critique != null && q <= critique) return { niveau: "CRITIQUE", couleur: "rouge", label: "Stock critique" };
  if (min != null && min > 0 && q <= min) return { niveau: "FAIBLE", couleur: "orange", label: "Stock faible" };
  return { niveau: "DISPONIBLE", couleur: "vert", label: "Disponible" };
}

/**
 * Palier de disponibilité destiné au CLIENT / VISITEUR (Catalogue §21.H) :
 * jamais la quantité exacte, seulement une tranche.
 */
export function paletteDisponibiliteClient(quantite: number, disponible = true): string {
  if (!disponible) return "Disponible sur commande";
  const q = Number(quantite) || 0;
  if (q <= 0) return "Disponible sur commande";
  if (q < 10) return "Stock limité";
  if (q <= 50) return "Disponible";
  return "Plus de 50 unités";
}
