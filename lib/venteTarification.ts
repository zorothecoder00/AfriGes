import { TypePrix, SegmentClient } from "@prisma/client";
import { resoudrePrix } from "@/lib/tarification";
import { prixPromotionnel } from "@/lib/promotionsServer";

/**
 * Tarification d'une ligne de vente au moment du checkout (Catalogue §4/§8/§9,
 * Enterprise #1/#2) — SERVEUR uniquement (importe Prisma via tarification /
 * promotionsServer). C'est le point de branchement entre le module Catalogue et
 * les flux Ventes / Caisse / Crédit : le serveur devient **autoritaire** sur le
 * prix (le §15 interdit la modification libre du prix), en résolvant le prix du
 * catalogue selon l'agence et le profil client, puis en appliquant la meilleure
 * promotion applicable.
 *
 * Filet de sécurité : si aucune ligne PrixProduit ne matche, on retombe sur
 * `Produit.prixUnitaire` (le miroir legacy = ligne GLOBAL DETAIL), donc les
 * produits pas encore tarifés dans le catalogue continuent de se vendre.
 */

// Champs produit nécessaires à la tarification (prix miroir + classification promo).
export interface ProduitTarifable {
  id: number;
  prixUnitaire: number | { toString(): string } | null;
  categorieId: number | null;
  familleId: number | null;
  marqueId: number | null;
}

export interface ContexteVente {
  pointDeVenteId?: number | null;
  clientId?: number | null;
  segment?: SegmentClient | null;
  /** Vente à crédit → prix CREDIT prioritaire, promotions désactivées par défaut. */
  aCredit?: boolean;
  /** Forcer l'application (ou non) des promotions ; défaut : true en comptant, false à crédit. */
  appliquerPromotions?: boolean;
}

export interface TarifLigne {
  prixCatalogue: number;   // prix résolu (avant promotion)
  prixUnitaire: number;    // prix unitaire facturé (après promotion, arrondi)
  quantite: number;        // quantité physique (déstockée)
  quantiteFacturee: number;// quantité facturée (offres LOT : < quantité)
  montant: number;         // total ligne facturé
  montantRemise: number;   // économie promo sur la ligne
  typePrix: TypePrix;      // type de prix retenu
  source: "CATALOGUE" | "MIROIR";
  promotion: { id: number; code: string; nom: string } | null;
}

/** Ordre de préférence des types de prix selon le contexte de vente. */
function ordreTypesPrix(ctx: ContexteVente): TypePrix[] {
  if (ctx.aCredit) return ["CREDIT", "DETAIL"];
  if (ctx.segment === "RIA") return ["COMMUNAUTE", "DETAIL"];
  return ["DETAIL"];
}

/**
 * Résout le prix d'une ligne : prix catalogue le plus adapté + promotion.
 * `resoudrePrix` et `prixPromotionnel` utilisent le client `prisma` global :
 * à appeler AVANT d'ouvrir la transaction de vente.
 */
export async function tariferLigne(
  produit: ProduitTarifable,
  quantite: number,
  ctx: ContexteVente = {},
  now: Date = new Date(),
): Promise<TarifLigne> {
  const qte = Math.max(1, Math.floor(Number(quantite) || 0));
  const miroir = Number(produit.prixUnitaire ?? 0) || 0;

  // 1. Prix de base résolu depuis le catalogue (agence + profil), sinon miroir legacy.
  let base: number | null = null;
  let typePrix: TypePrix = ctx.aCredit ? "CREDIT" : "DETAIL";
  let source: "CATALOGUE" | "MIROIR" = "MIROIR";
  for (const t of ordreTypesPrix(ctx)) {
    const p = await resoudrePrix(produit.id, t, { pointDeVenteId: ctx.pointDeVenteId }, now);
    if (p != null) { base = p; typePrix = t; source = "CATALOGUE"; break; }
  }
  if (base == null) base = miroir;

  // 2. Promotion (comptant par défaut ; les prix crédit portent déjà leur majoration).
  const appliquer = ctx.appliquerPromotions ?? !ctx.aCredit;
  let prixUnitaire = base;
  let quantiteFacturee = qte;
  let montantRemise = 0;
  let promotion: TarifLigne["promotion"] = null;

  if (appliquer) {
    const res = await prixPromotionnel(
      { id: produit.id, categorieId: produit.categorieId, familleId: produit.familleId, marqueId: produit.marqueId },
      base,
      { pointDeVenteId: ctx.pointDeVenteId, clientId: ctx.clientId, segment: ctx.segment },
      qte,
      now,
    );
    if (res) {
      prixUnitaire = res.prixRemise;
      quantiteFacturee = res.quantiteFacturee;
      montantRemise = res.montantRemise;
      promotion = { id: res.promotion.id, code: res.promotion.code, nom: res.promotion.nom };
    }
  }

  return {
    prixCatalogue: base,
    prixUnitaire,
    quantite: qte,
    quantiteFacturee,
    montant: prixUnitaire * qte,
    montantRemise,
    typePrix,
    source,
    promotion,
  };
}
