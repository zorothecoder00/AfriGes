import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLogistiqueSession } from "@/lib/authLogistique";

/**
 * GET /api/logistique/livraisons-packs
 *
 * Retourne les livraisons de produits-packs :
 *  - planifiees : PLANIFIEE (à confirmer)
 *  - livreesRecentes : LIVREE des 30 derniers jours
 *  - stats globales
 */
export async function GET() {
  try {
    const session = await getLogistiqueSession();
    if (!session) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const since30j = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [planifiees, livreesRecentes, totalPlanifiees, totalLivrees] =
      await Promise.all([
        prisma.receptionProduitPack.findMany({
          where: { statut: "PLANIFIEE" },
          orderBy: { datePrevisionnelle: "asc" },
          include: {
            souscription: {
              include: {
                pack: { select: { nom: true, type: true } },
                client: { select: { nom: true, prenom: true, telephone: true } },
                user: { select: { nom: true, prenom: true } },
              },
            },
            lignes: {
              include: { produit: { select: { nom: true, prixUnitaire: true } } },
            },
          },
        }),

        prisma.receptionProduitPack.findMany({
          where: { statut: "LIVREE", dateLivraison: { gte: since30j } },
          orderBy: { dateLivraison: "desc" },
          take: 30,
          include: {
            souscription: {
              include: {
                pack: { select: { nom: true, type: true } },
                client: { select: { nom: true, prenom: true, telephone: true } },
                user: { select: { nom: true, prenom: true } },
              },
            },
            lignes: {
              include: { produit: { select: { nom: true, prixUnitaire: true } } },
            },
          },
        }),

        prisma.receptionProduitPack.count({ where: { statut: "PLANIFIEE" } }),
        prisma.receptionProduitPack.count({ where: { statut: "LIVREE" } }),
      ]);

    return NextResponse.json({
      planifiees,
      livreesRecentes,
      stats: { totalPlanifiees, totalLivrees },
    });
  } catch (error) {
    console.error("GET /api/logistique/livraisons-packs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
