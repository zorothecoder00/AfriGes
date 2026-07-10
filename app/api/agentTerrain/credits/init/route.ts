import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { resoudrePrixBatch } from "@/lib/tarificationBatch";

/**
 * GET /api/agentTerrain/credits/init
 * Données d'initialisation pour le formulaire de demande de crédit :
 *   - clients actifs affectés à l'agent
 *   - produits disponibles au PDV (quantite - quantiteReservee > 0)
 */
export async function GET() {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const agentId = parseInt(session.user.id);

    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: agentId, actif: true },
      select: { pointDeVenteId: true },
    });

    const [clients, stocks] = await Promise.all([
      prisma.client.findMany({
        where: { agentTerrainId: agentId, etat: "ACTIF" },
        select: { id: true, nom: true, prenom: true, telephone: true },
        orderBy: { nom: "asc" },
      }),
      aff?.pointDeVenteId
        ? prisma.stockSite.findMany({
            where: { pointDeVenteId: aff.pointDeVenteId, quantite: { gt: 0 } },
            include: {
              produit: { select: { id: true, nom: true, reference: true, unite: true, prixUnitaire: true } },
            },
          })
        : [],
    ]);

    const produitsBase = stocks
      .map((s) => ({
        id:           s.produit.id,
        nom:          s.produit.nom,
        reference:    s.produit.reference,
        unite:        s.produit.unite,
        prixUnitaire: Number(s.produit.prixUnitaire),
        quantite:     s.quantite - s.quantiteReservee,
      }))
      .filter((p) => p.quantite > 0);

    // Prix CRÉDIT résolu (§4) pour pré-remplir la modale au bon montant (repli DETAIL puis miroir).
    const prixMap = await resoudrePrixBatch(produitsBase.map((p) => p.id), ["CREDIT", "DETAIL"], { pointDeVenteId: aff?.pointDeVenteId ?? null });
    const produitsDispo = produitsBase.map((p) => {
      const r = prixMap.get(p.id) ?? {};
      return { ...p, prixCredit: r.CREDIT ?? r.DETAIL ?? p.prixUnitaire };
    });

    return NextResponse.json({ clients, produitsDispo });
  } catch (error) {
    console.error("GET /api/agentTerrain/credits/init", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
