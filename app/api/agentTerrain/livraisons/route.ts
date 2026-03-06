import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";

/**
 * GET /api/agentTerrain/livraisons
 *
 * Retourne les livraisons planifiées (PLANIFIEE) en attente de confirmation,
 * ainsi que les livraisons récemment confirmées (LIVREE, 30 derniers jours).
 */
export async function GET(req: Request) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Résoudre le PDV de l'agent terrain
    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: parseInt(session.user.id), actif: true },
      select: { pointDeVenteId: true },
    });
    const pdvId = aff?.pointDeVenteId;
    // Filtre PDV : uniquement les livraisons pour des clients de son PDV
    const pdvFilter = pdvId ? { souscription: { client: { pointDeVenteId: pdvId } } } : {};

    // Permettre un paramètre optionnel pour ignorer le filtre PDV
    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all") === "true";
    const where = all ? {} : pdvFilter;

    const since30j = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [planifiees, livreesRecentes, totalPlanifiees, totalLivrees] =
      await Promise.all([
        // Réceptions PLANIFIEE du PDV de l'agent — à confirmer
        prisma.receptionProduitPack.findMany({
          where: { statut: "PLANIFIEE", ...where },
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

        // LIVREE des 30 derniers jours du PDV — historique récent
        prisma.receptionProduitPack.findMany({
          where: { statut: "LIVREE", dateLivraison: { gte: since30j }, ...where },
          orderBy: { dateLivraison: "desc" },
          take: 20,
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

        prisma.receptionProduitPack.count({ where: { statut: "PLANIFIEE", ...where } }),
        prisma.receptionProduitPack.count({ where: { statut: "LIVREE", ...where } }),
      ]);

    return NextResponse.json({
      planifiees,
      livreesRecentes,
      stats: { totalPlanifiees, totalLivrees },
    });
  } catch (error) {
    console.error("GET /api/agentTerrain/livraisons", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
