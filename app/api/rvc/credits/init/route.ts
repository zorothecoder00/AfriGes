import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";

/**
 * GET /api/rvc/credits/init
 * Données d'initialisation pour NouveauCreditModal :
 *   - clients actifs au PDV du RVC
 *   - produits disponibles au PDV (quantite - quantiteReservee > 0)
 */
export async function GET() {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    let pdvId: number | null = null;
    if (!isAdmin) {
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId, actif: true },
        select: { pointDeVenteId: true },
      });
      if (!aff?.pointDeVenteId) return NextResponse.json({ error: "Aucun PDV associé" }, { status: 400 });
      pdvId = aff.pointDeVenteId;
    }

    const [clients, stocks] = await Promise.all([
      prisma.client.findMany({
        where: {
          etat: "ACTIF",
          ...(pdvId !== null && { pointDeVenteId: pdvId }),
        },
        select: { id: true, nom: true, prenom: true, telephone: true },
        orderBy: { nom: "asc" },
      }),
      pdvId !== null
        ? prisma.stockSite.findMany({
            where: { pointDeVenteId: pdvId, quantite: { gt: 0 } },
            include: {
              produit: { select: { id: true, nom: true, reference: true, unite: true, prixUnitaire: true } },
            },
          })
        : [],
    ]);

    const produitsDispo = stocks
      .map((s) => ({
        id:           s.produit.id,
        nom:          s.produit.nom,
        reference:    s.produit.reference,
        unite:        s.produit.unite,
        prixUnitaire: Number(s.produit.prixUnitaire),
        quantite:     s.quantite - s.quantiteReservee,
      }))
      .filter((p) => p.quantite > 0);

    return NextResponse.json({ clients, produitsDispo });
  } catch (error) {
    console.error("GET /api/rvc/credits/init", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
