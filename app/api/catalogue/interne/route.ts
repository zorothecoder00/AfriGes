import { NextResponse } from "next/server";
import { Prisma, StatutProduit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

/**
 * GET /api/catalogue/interne
 * Catalogue produits en lecture seule pour le personnel (tous rôles authentifiés).
 * Contrairement à la vitrine publique (/api/catalogue/public), les prix de vente
 * réels et la disponibilité en stock sont exposés — mais aucune écriture n'est
 * possible (endpoint GET uniquement). Seuls les produits ACTIF sont listés.
 */
export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page   = Math.max(1, Number(searchParams.get("page") || 1));
  const limit  = Math.min(60, Math.max(1, Number(searchParams.get("limit") || 24)));
  const search = (searchParams.get("search") || "").trim();
  const familleId   = Number(searchParams.get("familleId")) || null;
  const categorieId = Number(searchParams.get("categorieId")) || null;
  const marqueId    = Number(searchParams.get("marqueId")) || null;

  const insensitive = { mode: "insensitive" as const };
  const where: Prisma.ProduitWhereInput = {
    statut: StatutProduit.ACTIF,
    ...(familleId && { familleId }),
    ...(categorieId && { categorieId }),
    ...(marqueId && { marqueId }),
    ...(search && {
      OR: [
        { nom:           { contains: search, ...insensitive } },
        { nomCommercial: { contains: search, ...insensitive } },
        { reference:     { contains: search, ...insensitive } },
        { codeProduit:   { contains: search, ...insensitive } },
        { codeBarre:     { contains: search } },
      ],
    }),
  };

  const [produits, total] = await Promise.all([
    prisma.produit.findMany({
      where, skip: (page - 1) * limit, take: limit, orderBy: { nom: "asc" },
      select: {
        id: true, codeProduit: true, reference: true, nom: true, nomCommercial: true,
        prixUnitaire: true, unite: true, alerteStock: true, imagePrincipaleUrl: true,
        marque: { select: { nom: true } },
        categorieProduit: { select: { nom: true } },
        famille: { select: { nom: true } },
        stocks: { select: { quantite: true } },
      },
    }),
    prisma.produit.count({ where }),
  ]);

  const data = produits.map((p) => {
    const stockTotal = p.stocks.reduce((s, x) => s + Number(x.quantite), 0);
    const seuil = p.alerteStock ?? 0;
    // Palier de disponibilité (jamais péjoratif sur la quantité exacte pour le personnel,
    // qui garde la valeur numérique, mais fournit un libellé lisible).
    const dispo = stockTotal <= 0 ? "RUPTURE" : stockTotal <= seuil ? "LIMITE" : "DISPONIBLE";
    return {
      id: p.id,
      codeProduit: p.codeProduit,
      reference: p.reference,
      nom: p.nomCommercial || p.nom,
      unite: p.unite,
      prixUnitaire: Number(p.prixUnitaire),
      marque: p.marque?.nom ?? null,
      categorie: p.categorieProduit?.nom ?? null,
      famille: p.famille?.nom ?? null,
      image: p.imagePrincipaleUrl,
      stockTotal,
      dispo,
    };
  });

  return NextResponse.json({
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}
