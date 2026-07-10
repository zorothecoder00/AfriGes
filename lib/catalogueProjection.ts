import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { grillePrixEffective } from "@/lib/tarification";
import { promotionApplicable } from "@/lib/promotionsServer";
import { libelleRemise } from "@/lib/promotions";
import { projeterProduit, type ProduitSource } from "@/lib/vuesCatalogue";
import { vueEffective } from "@/lib/vuesCatalogueServer";

/**
 * Projection du catalogue réel pour les surfaces de consommation (Catalogue
 * §21-24) — SERVEUR. Applique la MÊME projection (`projeterProduit` + vue
 * effective) que l'aperçu admin, mais sur le catalogue complet paginé/filtré :
 * c'est le point d'entrée des surfaces client / borne / vitrine visiteur, garant
 * de la synchro §24 (une seule vérité de projection, quel que soit le canal).
 *
 * Confidentialité : la vue (VISITEUR/CLIENT…) décide des champs visibles et du
 * mode stock ; les champs sensibles (coût, marge, emplacement, fournisseur) ne
 * sortent jamais d'une vue qui ne les liste pas, et le mode PALIER ne révèle
 * jamais la quantité exacte (§21.H).
 */

export interface OptionsProjectionCatalogue {
  cle: string;                       // clé de vue (VISITEUR, CLIENT, CLIENT_COMMUNAUTE…)
  search?: string | null;
  familleId?: number | null;
  categorieId?: number | null;
  marqueId?: number | null;
  pointDeVenteId?: number | null;    // agence de contexte (prix + stock) ; null = global
  page?: number;
  limit?: number;
}

export interface CatalogueProjete {
  vue: { cle: string; nom: string; modeStock: string; champsVisibles: string[] };
  data: Record<string, unknown>[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export async function projeterCatalogue(opts: OptionsProjectionCatalogue): Promise<CatalogueProjete | null> {
  const vue = await vueEffective(opts.cle);
  if (!vue) return null;

  const page  = Math.max(1, opts.page ?? 1);
  const limit = Math.min(60, Math.max(1, opts.limit ?? 24));
  const skip  = (page - 1) * limit;

  const where: Prisma.ProduitWhereInput = { statut: "ACTIF" };
  if (opts.familleId)   where.familleId   = opts.familleId;
  if (opts.categorieId) where.categorieId = opts.categorieId;
  if (opts.marqueId)    where.marqueId    = opts.marqueId;
  if (opts.search) {
    where.OR = [
      { nom:           { contains: opts.search, mode: "insensitive" } },
      { nomCommercial: { contains: opts.search, mode: "insensitive" } },
      { description:   { contains: opts.search, mode: "insensitive" } },
      { codeBarre:     { contains: opts.search, mode: "insensitive" } },
    ];
  }

  const stocksWhere = opts.pointDeVenteId ? { pointDeVenteId: opts.pointDeVenteId } : undefined;

  const [produits, total] = await Promise.all([
    prisma.produit.findMany({
      where, skip, take: limit, orderBy: { nom: "asc" },
      select: {
        id: true, nom: true, nomCommercial: true, description: true, codeProduit: true, reference: true,
        codeBarre: true, qrCode: true, prixUnitaire: true, prixAchat: true, imagePrincipaleUrl: true, paysOrigine: true,
        categorieId: true, familleId: true, marqueId: true,
        marque: { select: { nom: true } }, famille: { select: { nom: true } }, categorieProduit: { select: { nom: true } },
        fournisseurPrincipal: { select: { nom: true } },
        stocks: { where: stocksWhere, select: { quantite: true, disponible: true, rayon: true, etagere: true, allee: true } },
      },
    }),
    prisma.produit.count({ where }),
  ]);

  const geo = { pointDeVenteId: opts.pointDeVenteId ?? null };

  const data = await Promise.all(produits.map(async (p) => {
    const grille = await grillePrixEffective(p.id, geo);
    const promo  = await promotionApplicable(
      { id: p.id, categorieId: p.categorieId, familleId: p.familleId, marqueId: p.marqueId },
      geo,
    );
    const stock      = p.stocks.reduce((s, x) => s + Number(x.quantite), 0);
    const disponible = p.stocks.some((x) => x.disponible);
    const empl       = p.stocks.find((x) => x.rayon || x.etagere || x.allee);
    const prixVente  = Number(p.prixUnitaire);
    const prixAchat  = p.prixAchat != null ? Number(p.prixAchat) : null;

    const source: ProduitSource = {
      id: p.id,
      photo: p.imagePrincipaleUrl,
      nom: p.nom, nomCommercial: p.nomCommercial, description: p.description,
      codeProduit: p.codeProduit, reference: p.reference, codeBarre: p.codeBarre, qrCode: p.qrCode,
      marque: p.marque?.nom ?? null, famille: p.famille?.nom ?? null, categorie: p.categorieProduit?.nom ?? null,
      paysOrigine: p.paysOrigine, fournisseur: p.fournisseurPrincipal?.nom ?? null,
      prixDetail: grille.DETAIL ?? prixVente,
      prixCredit: grille.CREDIT ?? null,
      prixCommunaute: grille.COMMUNAUTE ?? null,
      prixGros: grille.GROS ?? null,
      promo: promo ? libelleRemise(promo) : null,
      prixAchat,
      marge: prixAchat != null ? prixVente - prixAchat : null,
      stock, disponible,
      emplacement: empl ? [empl.rayon, empl.etagere, empl.allee].filter(Boolean).join(" · ") : null,
      pointsFidelite: null,
      historiquePrix: null,
    };

    return projeterProduit(vue.champsVisibles, vue.modeStock, source);
  }));

  return {
    vue: { cle: vue.cle, nom: vue.nom, modeStock: vue.modeStock, champsVisibles: vue.champsVisibles },
    data,
    meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}
