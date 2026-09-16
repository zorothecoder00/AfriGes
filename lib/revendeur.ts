import { prisma } from "@/lib/prisma";
import { resoudrePrix } from "@/lib/tarification";

/**
 * Revendeurs / B2B (CDC digitalisation §5.6) — helpers serveur partagés entre
 * les routes /api/admin/revendeurs/* et /api/revendeur/*.
 */

/**
 * Prix d'une ligne de commande revendeur : grille tarifaire catalogue
 * TypePrix.GROS (prévue pour cet usage), repli DETAIL, puis prix miroir
 * Produit.prixUnitaire — même stratégie de repli que tariferLigne
 * (lib/venteTarification.ts), sans dépendre de ce module pour ne pas toucher
 * au flux de vente comptant/crédit déjà en production.
 */
export async function prixRevendeur(
  produit: { id: number; prixUnitaire: number | { toString(): string } | null },
  pointDeVenteId: number | null | undefined,
): Promise<number> {
  const now = new Date();
  const gros = await resoudrePrix(produit.id, "GROS", { pointDeVenteId }, now);
  if (gros != null) return gros;
  const detail = await resoudrePrix(produit.id, "DETAIL", { pointDeVenteId }, now);
  if (detail != null) return detail;
  return Number(produit.prixUnitaire ?? 0) || 0;
}

/** Statistiques d'achat d'un revendeur — "État des achats" (§5.6). */
export async function statsAchatsRevendeur(revendeurId: number) {
  const factures = await prisma.factureVente.findMany({
    where: { revendeurId, statut: "EMISE" },
    select: { montantTTC: true, montantPaye: true, dateEmission: true },
  });
  const totalFacture = factures.reduce((s, f) => s + Number(f.montantTTC), 0);
  const totalPaye = factures.reduce((s, f) => s + Number(f.montantPaye), 0);
  return {
    nbFactures: factures.length,
    totalFacture,
    totalPaye,
    soldeDu: totalFacture - totalPaye,
    premierAchat: factures.length ? factures.reduce((min, f) => (f.dateEmission < min ? f.dateEmission : min), factures[0].dateEmission) : null,
  };
}
