import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { resolveViewAs } from "@/lib/viewAs";

/**
 * GET /api/magasinier/livraisons-packs
 * Liste les ReceptionProduitPack PLANIFIEE dont les produits doivent sortir
 * du stock géré par ce magasinier (filtre par PDV d'affectation).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const viewAs  = isAdmin ? resolveViewAs(req) : null;
    const effectiveUserId = viewAs?.userId ?? parseInt(session.user.id);

    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: effectiveUserId, actif: true },
      select: { pointDeVenteId: true },
    });
    const pdvId = aff?.pointDeVenteId;

    // Filtre par PDV du magasinier :
    // - Pas de PDV → voit toutes les livraisons planifiées
    // - PDV affecté → voit :
    //     1. Livraisons avec pointDeVenteId explicitement défini = ce PDV (nouvelle logique)
    //     2. Livraisons sans pointDeVenteId (rétrocompatibilité) filtrées via le client
    const pdvFilter = pdvId
      ? {
          OR: [
            // Nouvelle logique : PDV explicite sur la livraison
            { pointDeVenteId: pdvId },
            // Rétrocompatibilité : anciennes livraisons sans PDV explicite
            {
              pointDeVenteId: null,
              OR: [
                { souscription: { client: { pointDeVenteId: pdvId } } },
                { souscription: { client: { pointDeVenteId: null } } },
                { souscription: { clientId: null } },
                {
                  souscription: {
                    user: {
                      affectationsPDV: { some: { pointDeVenteId: pdvId, actif: true } },
                    },
                  },
                },
              ],
            },
          ],
        }
      : {};

    const [planifiees, livreesRecentes] = await Promise.all([
      prisma.receptionProduitPack.findMany({
        where: { statut: "PLANIFIEE", ...pdvFilter },
        orderBy: { datePrevisionnelle: "asc" },
        include: {
          souscription: {
            include: {
              pack: { select: { id: true, nom: true, type: true } },
              client: { select: { nom: true, prenom: true, telephone: true, pointDeVenteId: true, pointDeVente: { select: { nom: true } } } },
              user: { select: { nom: true, prenom: true, telephone: true } },
            },
          },
          lignes: {
            include: {
              produit: { select: { id: true, nom: true, unite: true, prixUnitaire: true, prixAchat: true } },
            },
          },
        },
      }),
      prisma.receptionProduitPack.findMany({
        where: {
          statut: "LIVREE",
          dateLivraison: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          ...pdvFilter,
        },
        orderBy: { dateLivraison: "desc" },
        take: 20,
        include: {
          souscription: {
            include: {
              pack: { select: { nom: true, type: true } },
              client: { select: { nom: true, prenom: true } },
              user: { select: { nom: true, prenom: true } },
            },
          },
          lignes: {
            include: { produit: { select: { nom: true, unite: true, prixAchat: true } } },
          },
        },
      }),
    ]);

    return NextResponse.json({
      planifiees,
      livreesRecentes,
      stats: { totalPlanifiees: planifiees.length },
    });
  } catch (error) {
    console.error("GET /api/magasinier/livraisons-packs:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
