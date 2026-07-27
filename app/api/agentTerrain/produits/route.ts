import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { resoudrePrixBatch } from "@/lib/tarificationBatch";
import { projeterProduit, type ProduitSource } from "@/lib/vuesCatalogue";
import { vueEffective } from "@/lib/vuesCatalogueServer";
import { promotionApplicable } from "@/lib/promotionsServer";
import { libelleRemise } from "@/lib/promotions";

/**
 * GET /api/agentTerrain/produits
 * Recherche de produits du catalogue pour l'agent terrain (création de demande de crédit).
 * Champs additionnels gouvernés par la vue COMMERCIAL_TERRAIN (Catalogue §21.F/§22).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const limit  = Math.min(20, Math.max(1, Number(searchParams.get("limit") || 10)));

    const produits = await prisma.produit.findMany({
      where: {
        actif: true,
        ...(search && {
          OR: [
            { nom:       { contains: search, mode: "insensitive" } },
            { reference: { contains: search, mode: "insensitive" } },
          ],
        }),
      },
      select: {
        id: true, nom: true, reference: true, prixUnitaire: true, unite: true,
        imagePrincipaleUrl: true, codeBarre: true, qrCode: true,
        categorieId: true, familleId: true, marqueId: true,
      },
      orderBy: { nom: "asc" },
      take: limit,
    });

    const prixMap = await resoudrePrixBatch(produits.map(p => p.id), ["DETAIL", "CREDIT"], {});
    const vue = await vueEffective("COMMERCIAL_TERRAIN");

    const data = await Promise.all(produits.map(async (p) => {
      const prixDetail = prixMap.get(p.id)?.DETAIL ?? Number(p.prixUnitaire);
      const compat = { id: p.id, nom: p.nom, reference: p.reference, prixUnitaire: Number(p.prixUnitaire), unite: p.unite };
      if (!vue) return compat;

      const promo = await promotionApplicable(
        { id: p.id, categorieId: p.categorieId, familleId: p.familleId, marqueId: p.marqueId },
        {},
      );
      const source: ProduitSource = {
        id: p.id, photo: p.imagePrincipaleUrl, nom: p.nom,
        prixDetail, prixCredit: prixMap.get(p.id)?.CREDIT ?? null,
        promo: promo ? libelleRemise(promo) : null,
        codeBarre: p.codeBarre, qrCode: p.qrCode,
      };
      const projected = projeterProduit(vue.champsVisibles, vue.modeStock, source);
      delete projected.stock; // pas de contexte PDV ici (recherche hors stock)
      return { ...compat, ...projected };
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/agentTerrain/produits", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
