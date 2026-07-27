import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { etatPeremption } from "@/lib/lotsFefo";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/magasinier/produits/[id]/lots
 * Lots (FEFO) d'un produit sur le PDV du magasinier connecté, avec état de
 * péremption — visibilité en lecture seule (traçabilité DLC/DLUO, CDC
 * Catalogue Ent.#5 côté magasinier).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const produitId = Number((await params).id);
    if (!produitId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: parseInt(session.user.id), actif: true },
      select: { pointDeVenteId: true },
    });
    if (!aff) return NextResponse.json({ error: "Aucun point de vente associé" }, { status: 400 });

    const lots = await prisma.lotProduit.findMany({
      where: { produitId, pointDeVenteId: aff.pointDeVenteId },
      orderBy: [{ statut: "asc" }, { dlc: { sort: "asc", nulls: "last" } }, { dateReception: "asc" }],
      select: {
        id: true, numeroLot: true, quantiteInitiale: true, quantite: true,
        dlc: true, dluo: true, dateReception: true, statut: true,
        fournisseur: { select: { id: true, nom: true } },
      },
    });

    return NextResponse.json({
      data: lots.map((l) => ({ ...l, peremption: etatPeremption(l.dlc) })),
    });
  } catch (error) {
    console.error("GET /magasinier/produits/[id]/lots:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
