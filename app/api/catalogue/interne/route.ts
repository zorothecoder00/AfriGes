import { NextResponse } from "next/server";
import { Prisma, StatutProduit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { resolveViewAs } from "@/lib/viewAs";
import { resolveUserPdvs } from "@/lib/userPdv";

/**
 * GET /api/catalogue/interne
 * Catalogue produits en lecture seule pour le personnel (tous rôles authentifiés).
 * Contrairement à la vitrine publique (/api/catalogue/public), les prix de vente
 * réels et la disponibilité en stock sont exposés — mais aucune écriture n'est
 * possible (endpoint GET uniquement). Seuls les produits ACTIF sont listés.
 *
 * Cloisonnement PDV (autoritaire, côté serveur) : un utilisateur rattaché à un
 * ou plusieurs points de vente ne voit QUE le stock et la disponibilité de son
 * périmètre — jamais ceux des autres PDV. Un compte transverse sans PDV (Admin)
 * voit l'ensemble du réseau.
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
  const pointDeVenteId = Number(searchParams.get("pointDeVenteId")) || null;

  // ── Périmètre PDV autoritaire ────────────────────────────────────────────────
  const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
  const viewAs  = isAdmin ? resolveViewAs(req) : null;
  const userId  = viewAs?.userId ?? Number(session.user.id);
  const myPdvs  = await resolveUserPdvs(userId);
  const allowedIds = myPdvs.map((p) => p.id);
  const scoped = allowedIds.length > 0;

  // PDV effectif : un utilisateur rattaché reste confiné à ses PDV (le filtre client
  // hors périmètre est ignoré) ; un compte sans PDV voit tout, avec filtre optionnel.
  let pdvIds: number[] | null;
  if (scoped) {
    pdvIds = pointDeVenteId && allowedIds.includes(pointDeVenteId) ? [pointDeVenteId] : allowedIds;
  } else {
    pdvIds = pointDeVenteId ? [pointDeVenteId] : null;
  }

  // Sites pris en compte : commercialisés (flag `disponible`) et dans le périmètre.
  const stocksWhere: Prisma.StockSiteWhereInput = {
    disponible: true,
    ...(pdvIds && { pointDeVenteId: { in: pdvIds } }),
  };

  const insensitive = { mode: "insensitive" as const };
  const where: Prisma.ProduitWhereInput = {
    statut: StatutProduit.ACTIF,
    ...(familleId && { familleId }),
    ...(categorieId && { categorieId }),
    ...(marqueId && { marqueId }),
    // Utilisateur rattaché à un PDV : ne montrer que les produits commercialisés
    // dans son périmètre (pas de fuite d'existence produit d'autres agences).
    ...(pdvIds && { stocks: { some: stocksWhere } }),
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
        stocks: {
          where: stocksWhere,
          select: {
            quantite: true,
            pointDeVente: { select: { id: true, nom: true, code: true } },
          },
        },
      },
    }),
    prisma.produit.count({ where }),
  ]);

  const data = produits.map((p) => {
    // Ventilation par point de vente (uniquement les sites commercialisés).
    const parPdv = p.stocks.map((s) => ({
      pdvId: s.pointDeVente.id,
      pdvNom: s.pointDeVente.nom,
      pdvCode: s.pointDeVente.code,
      quantite: Number(s.quantite),
    })).sort((a, b) => b.quantite - a.quantite);

    const stockTotal = parPdv.reduce((s, x) => s + x.quantite, 0);
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
      parPdv,
      dispo,
    };
  });

  return NextResponse.json({
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}
