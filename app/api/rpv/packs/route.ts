import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";

/**
 * GET — Vue RPV : souscriptions complètes en attente de livraison produit +
 *        réceptions planifiées.
 */
export async function GET() {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const [souscriptionsCompletes, receptionsEnCours, statsParType] = await Promise.all([
      // Souscriptions soldées sans réception livrée
      prisma.souscriptionPack.findMany({
        where: {
          statut: "COMPLETE",
          receptions: { none: { statut: "LIVREE" } },
        },
        include: {
          pack: { select: { nom: true, type: true } },
          user: { select: { nom: true, prenom: true, telephone: true } },
          client: { select: { nom: true, prenom: true, telephone: true } },
          receptions: {
            include: {
              lignes: { include: { produit: { select: { nom: true } } } },
            },
          },
        },
        orderBy: { dateCloture: "asc" },
      }),

      // Réceptions planifiées pas encore livrées
      prisma.receptionProduitPack.findMany({
        where: { statut: "PLANIFIEE" },
        include: {
          souscription: {
            include: {
              pack: { select: { nom: true, type: true } },
              user: { select: { nom: true, prenom: true } },
              client: { select: { nom: true, prenom: true } },
            },
          },
          lignes: { include: { produit: { select: { nom: true, prixUnitaire: true } } } },
        },
        orderBy: { datePrevisionnelle: "asc" },
      }),

      // Stats par type de pack
      prisma.souscriptionPack.groupBy({
        by: ["statut"],
        _count: true,
        _sum: { montantVerse: true, montantTotal: true },
      }),
    ]);

    return NextResponse.json({ souscriptionsCompletes, receptionsEnCours, statsParType });
  } catch (error) {
    console.error("GET /api/rpv/packs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
