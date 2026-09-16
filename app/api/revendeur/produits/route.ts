import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRevendeurSession } from "@/lib/authRevendeur";
import { prixRevendeur } from "@/lib/revendeur";

/**
 * GET /api/revendeur/produits — catalogue disponible au PDV de rattachement
 * du revendeur, avec le prix grille GROS résolu (§5.6). Distinct de
 * /api/admin/stock (réservé Admin, inaccessible à un compte REVENDEUR).
 * Query : search?
 */
export async function GET(req: Request) {
  try {
    const session = await getRevendeurSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);
    const profil = await prisma.profilRevendeur.findUnique({ where: { userId }, select: { pointDeVenteId: true, statut: true } });
    if (!profil) return NextResponse.json({ error: "Aucun compte revendeur ouvert" }, { status: 404 });
    if (!profil.pointDeVenteId) return NextResponse.json({ data: [] });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim();

    const stocks = await prisma.stockSite.findMany({
      where: {
        pointDeVenteId: profil.pointDeVenteId,
        disponible: true,
        quantite: { gt: 0 },
        produit: search ? { nom: { contains: search, mode: "insensitive" } } : undefined,
      },
      select: {
        quantite: true,
        produit: { select: { id: true, nom: true, codeProduit: true, prixUnitaire: true, categorieId: true, familleId: true, marqueId: true } },
      },
      take: 100,
    });

    const data = await Promise.all(stocks.map(async (s) => ({
      produitId: s.produit.id,
      nom: s.produit.nom,
      codeProduit: s.produit.codeProduit,
      stock: s.quantite,
      prixUnitaire: await prixRevendeur(s.produit, profil.pointDeVenteId),
    })));

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /revendeur/produits:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
