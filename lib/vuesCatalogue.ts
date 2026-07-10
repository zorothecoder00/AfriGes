import type { ModeStockVue } from "@prisma/client";
import { paletteDisponibiliteClient } from "@/lib/etatStock";

/**
 * Moteur de vues catalogue (Catalogue §21-24) — MODULE PUR (client-safe).
 * Décrit le catalogue des CHAMPS affichables d'un produit, les vues par défaut
 * par rôle (A→J, §21), et la projection d'un produit selon une vue (§22). Le
 * mode stock gère le palier client (§21.H) qui ne révèle jamais la quantité
 * exacte. Pas d'import Prisma runtime → importable côté client.
 */

export type ModeStock = ModeStockVue; // "EXACT" | "PALIER" | "AUCUN"

export const MODES_STOCK: { cle: ModeStock; label: string }[] = [
  { cle: "EXACT", label: "Quantité exacte" },
  { cle: "PALIER", label: "Palier (sans quantité)" },
  { cle: "AUCUN", label: "Masqué" },
];

export interface ChampCatalogue {
  key: string;
  label: string;
  groupe: string;
  sensible?: boolean; // donnée confidentielle (coût, marge, emplacement…)
}

// Catalogue des champs projetables. `stock` est piloté par le mode stock de la vue.
export const CHAMPS_CATALOGUE: ChampCatalogue[] = [
  { key: "photo",          label: "Photo",              groupe: "Identité" },
  { key: "nom",            label: "Nom",                groupe: "Identité" },
  { key: "nomCommercial",  label: "Nom commercial",     groupe: "Identité" },
  { key: "description",    label: "Description",        groupe: "Identité" },
  { key: "codeProduit",    label: "Code produit",       groupe: "Identité" },
  { key: "reference",      label: "Référence",          groupe: "Identité" },
  { key: "codeBarre",      label: "Code-barres",        groupe: "Identité" },
  { key: "qrCode",         label: "QR code",            groupe: "Identité" },

  { key: "marque",         label: "Marque",             groupe: "Classification" },
  { key: "famille",        label: "Famille",            groupe: "Classification" },
  { key: "categorie",      label: "Catégorie",          groupe: "Classification" },
  { key: "paysOrigine",    label: "Pays d'origine",     groupe: "Classification" },
  { key: "fournisseur",    label: "Fournisseur",        groupe: "Classification", sensible: true },

  { key: "prixDetail",     label: "Prix comptant",      groupe: "Prix" },
  { key: "prixCredit",     label: "Prix crédit",        groupe: "Prix" },
  { key: "prixCommunaute", label: "Prix Communauté",    groupe: "Prix" },
  { key: "prixGros",       label: "Prix de gros",       groupe: "Prix" },
  { key: "promo",          label: "Promotion",          groupe: "Prix" },
  { key: "prixAchat",      label: "Prix d'achat",       groupe: "Prix", sensible: true },
  { key: "marge",          label: "Marge",              groupe: "Prix", sensible: true },

  { key: "stock",          label: "Stock / disponibilité", groupe: "Stock" },
  { key: "emplacement",    label: "Emplacement",        groupe: "Stock", sensible: true },

  { key: "pointsFidelite", label: "Points fidélité",    groupe: "Fidélité" },
  { key: "historiquePrix", label: "Historique des prix", groupe: "Traçabilité", sensible: true },
];

export const GROUPES_CHAMPS = ["Identité", "Classification", "Prix", "Stock", "Fidélité", "Traçabilité"] as const;

export interface VueRole {
  cle: string;
  nom: string;
  description: string;
  champsDefaut: string[];
  modeStock: ModeStock;
}

const TOUS = CHAMPS_CATALOGUE.map((c) => c.key);

// Vues par défaut par rôle (§21 A→J). Servent de graine ; l'admin peut les
// personnaliser (persistées dans VueCatalogue).
export const VUES_ROLES: VueRole[] = [
  { cle: "ADMIN", nom: "Administrateur", description: "Accès à tous les champs.", champsDefaut: TOUS, modeStock: "EXACT" },
  { cle: "DIRECTEUR_COMMERCIAL", nom: "Directeur commercial", description: "Tous les indicateurs commerciaux et marges.", champsDefaut: TOUS.filter((k) => k !== "emplacement"), modeStock: "EXACT" },
  { cle: "RESP_APPRO", nom: "Responsable approvisionnement", description: "Coûts, fournisseurs, stock et emplacement.", champsDefaut: ["photo", "nom", "codeProduit", "reference", "codeBarre", "marque", "famille", "categorie", "fournisseur", "prixAchat", "marge", "stock", "emplacement"], modeStock: "EXACT" },
  { cle: "CHEF_AGENCE", nom: "Chef d'agence", description: "Vue de son agence : prix de vente, promo, stock.", champsDefaut: ["photo", "nom", "codeProduit", "codeBarre", "marque", "famille", "categorie", "prixDetail", "prixCredit", "promo", "stock", "emplacement"], modeStock: "EXACT" },
  { cle: "CAISSIER", nom: "Caissier", description: "Encaissement : prix comptant/crédit, promo, stock, codes.", champsDefaut: ["photo", "nom", "prixDetail", "prixCredit", "promo", "stock", "codeBarre", "qrCode"], modeStock: "EXACT" },
  { cle: "COMMERCIAL_TERRAIN", nom: "Commercial / Agent terrain", description: "Vente & prospection : fiche commerciale complète.", champsDefaut: ["photo", "nom", "description", "marque", "prixDetail", "prixCredit", "promo", "stock", "codeBarre", "qrCode"], modeStock: "EXACT" },
  { cle: "CLIENT", nom: "Client", description: "Appli/borne : prix public, promo, disponibilité par palier.", champsDefaut: ["photo", "nom", "description", "prixDetail", "promo", "stock"], modeStock: "PALIER" },
  { cle: "CLIENT_COMMUNAUTE", nom: "Client Communauté", description: "Prix Communauté, points de fidélité, promotions exclusives.", champsDefaut: ["photo", "nom", "description", "prixDetail", "prixCommunaute", "promo", "pointsFidelite", "stock"], modeStock: "PALIER" },
  { cle: "VISITEUR", nom: "Visiteur", description: "Vitrine publique : rien de confidentiel.", champsDefaut: ["photo", "nom", "description", "prixDetail", "promo", "stock"], modeStock: "PALIER" },
];

export function vueRoleDefaut(cle: string): VueRole | undefined {
  return VUES_ROLES.find((v) => v.cle === cle);
}

/** Un champ est-il confidentiel (à ne pas exposer aux vues client/visiteur) ? */
export function estSensible(key: string): boolean {
  return CHAMPS_CATALOGUE.find((c) => c.key === key)?.sensible ?? false;
}

// Produit source (tous champs optionnels) pour la projection.
export interface ProduitSource {
  id: number;
  photo?: string | null;
  nom?: string | null;
  nomCommercial?: string | null;
  description?: string | null;
  codeProduit?: string | null;
  reference?: string | null;
  codeBarre?: string | null;
  qrCode?: string | null;
  marque?: string | null;
  famille?: string | null;
  categorie?: string | null;
  paysOrigine?: string | null;
  fournisseur?: string | null;
  prixDetail?: number | null;
  prixCredit?: number | null;
  prixCommunaute?: number | null;
  prixGros?: number | null;
  promo?: string | null;
  prixAchat?: number | null;
  marge?: number | null;
  stock?: number | null;
  disponible?: boolean;
  emplacement?: string | null;
  pointsFidelite?: number | null;
  historiquePrix?: unknown;
}

/**
 * Projette un produit selon une vue : ne conserve que les champs visibles et
 * traite le stock selon le mode (exact / palier / masqué). `id` est toujours
 * conservé. Renvoie un objet prêt à être sérialisé pour la surface cible (§24).
 */
export function projeterProduit(
  champsVisibles: string[],
  modeStock: ModeStock,
  produit: ProduitSource,
): Record<string, unknown> {
  const visibles = new Set(champsVisibles);
  const out: Record<string, unknown> = { id: produit.id };

  for (const champ of CHAMPS_CATALOGUE) {
    if (champ.key === "stock") continue; // traité à part
    if (!visibles.has(champ.key)) continue;
    out[champ.key] = (produit as unknown as Record<string, unknown>)[champ.key] ?? null;
  }

  if (visibles.has("stock") && modeStock !== "AUCUN") {
    if (modeStock === "EXACT") {
      out.stock = produit.stock ?? 0;
    } else {
      out.stock = paletteDisponibiliteClient(produit.stock ?? 0, produit.disponible ?? true);
    }
  }

  return out;
}
