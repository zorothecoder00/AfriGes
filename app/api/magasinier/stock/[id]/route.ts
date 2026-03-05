import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Récupère le PDV actif du magasinier connecté.
 */
async function getPDVMagasinier(userId: number) {
  const aff = await prisma.gestionnaireAffectation.findFirst({
    where: { userId, actif: true },
    select: { pointDeVenteId: true },
  });
  return aff?.pointDeVenteId ?? null;
}

/**
 * GET /api/magasinier/stock/[id]
 * Fiche produit avec stock sur le PDV du magasinier + mouvements filtrés par ce PDV.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const produitId = Number(id);
    if (isNaN(produitId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const pdvId = await getPDVMagasinier(parseInt(session.user.id));
    if (!pdvId) return NextResponse.json({ error: "Aucun point de vente associé à ce magasinier" }, { status: 400 });

    const produit = await prisma.produit.findUnique({
      where: { id: produitId },
      include: {
        stocks: {
          where: { pointDeVenteId: pdvId },
          include: { pointDeVente: { select: { id: true, nom: true, code: true } } },
        },
        mouvements: {
          where: { pointDeVenteId: pdvId },
          orderBy: { dateMouvement: "desc" },
          take: 50,
          include: {
            operateur: { select: { id: true, nom: true, prenom: true } },
          },
        },
      },
    });

    if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

    const stockSite = produit.stocks[0];
    const stockQte  = stockSite?.quantite ?? 0;

    return NextResponse.json({
      data: {
        ...produit,
        stockSite,
        stockQte,
        valeurStock: stockQte * Number(produit.prixUnitaire),
      },
    });
  } catch (error) {
    console.error("GET /magasinier/stock/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
