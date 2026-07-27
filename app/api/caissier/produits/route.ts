import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCaissierSession, getCaissierPdvId } from "@/lib/authCaissier";
import { resoudrePrixBatch } from "@/lib/tarificationBatch";
import { projeterProduit, type ProduitSource } from "@/lib/vuesCatalogue";
import { vueEffective } from "@/lib/vuesCatalogueServer";
import { promotionApplicable } from "@/lib/promotionsServer";
import { libelleRemise } from "@/lib/promotions";

/**
 * GET /api/caissier/produits
 * Recherche de produits en stock sur le PDV du caissier.
 * Query: search, limit
 *
 * Champs de base (id/nom/unite/reference/prixUnitaire/prixDetail) conservés
 * pour compat avec le picker partagé `FactureModal`. Les champs supplémentaires
 * (photo/prixCredit/promo/stock/codeBarre/qrCode) sont gouvernés par la vue
 * CAISSIER (Catalogue §21.E/§22) — n'apparaissent que si l'admin les autorise.
 */
export async function GET(req: Request) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId   = isAdmin ? null : await getCaissierPdvId(userId);

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();
    const limit  = Math.min(20, Math.max(1, Number(searchParams.get("limit") || 10)));

    const searchConditions: Prisma.ProduitWhereInput = search
      ? {
          OR: [
            { nom:         { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { reference:   { contains: search, mode: "insensitive" } },
            { codeBarre:   { contains: search } }, // scan douchette au comptoir (§11)
            { qrCode:      { contains: search } },
          ],
        }
      : {};

    const where: Prisma.ProduitWhereInput = {
      actif: true,
      ...(pdvId ? { stocks: { some: { pointDeVenteId: pdvId } } } : {}),
      ...searchConditions,
    };

    const produits = await prisma.produit.findMany({
      where,
      take: limit,
      orderBy: { nom: "asc" },
      select: {
        id:                 true,
        nom:                true,
        unite:              true,
        prixUnitaire:       true,
        reference:          true,
        imagePrincipaleUrl: true,
        codeBarre:          true,
        qrCode:             true,
        categorieId:        true,
        familleId:          true,
        marqueId:           true,
        stocks: { where: pdvId ? { pointDeVenteId: pdvId } : undefined, select: { quantite: true } },
      },
    });

    // Prix DETAIL + CREDIT résolus par agence (§8) pour l'affichage vente comptant / pro-forma.
    const prixMap = await resoudrePrixBatch(produits.map(p => p.id), ["DETAIL", "CREDIT"], { pointDeVenteId: pdvId });
    const vue = await vueEffective("CAISSIER");

    const data = await Promise.all(produits.map(async (p) => {
      const pu          = Number(p.prixUnitaire);
      const prixDetail  = prixMap.get(p.id)?.DETAIL ?? pu;
      // Compat : champs attendus par le picker partagé (FactureModal).
      const compat = { id: p.id, nom: p.nom, unite: p.unite, reference: p.reference, prixUnitaire: pu, prixDetail };
      if (!vue) return compat;

      const stock = p.stocks.reduce((s, x) => s + x.quantite, 0);
      const promo = await promotionApplicable(
        { id: p.id, categorieId: p.categorieId, familleId: p.familleId, marqueId: p.marqueId },
        { pointDeVenteId: pdvId },
      );

      const source: ProduitSource = {
        id: p.id,
        photo: p.imagePrincipaleUrl,
        nom: p.nom,
        prixDetail,
        prixCredit: prixMap.get(p.id)?.CREDIT ?? null,
        promo: promo ? libelleRemise(promo) : null,
        stock, disponible: stock > 0,
        codeBarre: p.codeBarre, qrCode: p.qrCode,
      };
      const projected = projeterProduit(vue.champsVisibles, vue.modeStock, source);
      return { ...compat, ...projected };
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/caissier/produits", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
