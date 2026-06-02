import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { resolveViewAs } from "@/lib/viewAs";

/**
 * GET /api/magasinier/ventes-credit
 * Ventes crédit en CREDIT_EN_LIVRAISON (sortie stock à confirmer) + CREDIT_LIVRE récentes (30j).
 * Scoped au PDV du magasinier.
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
    if (!aff?.pointDeVenteId) {
      return NextResponse.json({ error: "Aucun point de vente associé" }, { status: 400 });
    }
    const pdvId   = aff.pointDeVenteId;
    const since30j = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const include = {
      vendeur:      { select: { id: true, nom: true, prenom: true } },
      client:       { select: { id: true, nom: true, prenom: true, telephone: true } },
      creditClient: {
        select: {
          id: true, reference: true, statut: true,
          montantTotal: true, montantConsomme: true,
        },
      },
      lignes: {
        include: {
          produit: { select: { id: true, nom: true, unite: true } },
        },
        orderBy: { id: "asc" as const },
      },
    };

    const [aConfirmer, livreesRecentes] = await Promise.all([
      prisma.venteDirecte.findMany({
        where:   { pointDeVenteId: pdvId, statut: "CREDIT_EN_LIVRAISON" },
        orderBy: { updatedAt: "asc" },
        include,
      }),
      prisma.venteDirecte.findMany({
        where:   { pointDeVenteId: pdvId, statut: "CREDIT_LIVRE", updatedAt: { gte: since30j } },
        orderBy: { updatedAt: "desc" },
        take:    30,
        include,
      }),
    ]);

    const format = (v: typeof aConfirmer[0]) => ({
      id:           v.id,
      reference:    v.reference,
      statut:       v.statut,
      montantTotal: Number(v.montantTotal),
      createdAt:    v.createdAt.toISOString(),
      updatedAt:    v.updatedAt.toISOString(),
      vendeur:      v.vendeur ? `${v.vendeur.prenom} ${v.vendeur.nom}` : null,
      client:       v.client
        ? { id: v.client.id, nom: `${v.client.prenom} ${v.client.nom}`, telephone: v.client.telephone }
        : { id: null, nom: v.clientNom ?? "—", telephone: v.clientTelephone ?? null },
      creditClient: v.creditClient
        ? {
            id:              v.creditClient.id,
            reference:       v.creditClient.reference,
            montantTotal:    Number(v.creditClient.montantTotal),
            montantConsomme: Number(v.creditClient.montantConsomme),
          }
        : null,
      lignes: v.lignes.map((l) => ({
        id:           l.id,
        produitId:    l.produitId,
        produitNom:   l.produitId ? l.produit?.nom : l.produitNom,
        unite:        l.produit?.unite ?? null,
        quantite:     l.quantite,
        prixUnitaire: Number(l.prixUnitaire),
        montant:      Number(l.montant),
        horscatalogue: !l.produitId,
      })),
    });

    return NextResponse.json({
      aConfirmer:       aConfirmer.map(format),
      livreesRecentes:  livreesRecentes.map(format),
      totalAConfirmer:  aConfirmer.length,
    });
  } catch (error) {
    console.error("GET /api/magasinier/ventes-credit:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
