import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";

/**
 * GET /api/magasinier/ventes-terrain
 * Ventes directes terrain CONFIRMEE (sortie stock à effectuer) du PDV du magasinier.
 * Inclut aussi les SORTIE_VALIDEE récentes (30j) pour historique.
 */
export async function GET() {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: parseInt(session.user.id), actif: true },
      select: { pointDeVenteId: true },
    });
    if (!aff?.pointDeVenteId) {
      return NextResponse.json({ error: "Aucun point de vente associé" }, { status: 400 });
    }
    const pdvId = aff.pointDeVenteId;
    const since30j = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const include = {
      vendeur: { select: { id: true, nom: true, prenom: true } },
      client:  { select: { id: true, nom: true, prenom: true, telephone: true } },
      lignes: {
        include: { produit: { select: { id: true, nom: true, unite: true, prixUnitaire: true } } },
      },
    };

    const [aLivrer, livreesRecentes] = await Promise.all([
      prisma.venteDirecte.findMany({
        where: { pointDeVenteId: pdvId, statut: "CONFIRMEE" },
        orderBy: { createdAt: "asc" },
        include,
      }),
      prisma.venteDirecte.findMany({
        where: { pointDeVenteId: pdvId, statut: "SORTIE_VALIDEE", updatedAt: { gte: since30j } },
        orderBy: { updatedAt: "desc" },
        take: 20,
        include,
      }),
    ]);

    return NextResponse.json({ aLivrer, livreesRecentes, totalALivrer: aLivrer.length });
  } catch (error) {
    console.error("GET /magasinier/ventes-terrain:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
