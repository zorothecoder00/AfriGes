import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { resolveViewAs } from "@/lib/viewAs";

/**
 * GET /api/magasinier/credits
 * Liste les CreditClient du PDV du magasinier ayant au moins une ligne EN_ATTENTE.
 * Utilisé pour la confirmation des livraisons physiques.
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
    const pdvId = aff.pointDeVenteId;

    const credits = await prisma.creditClient.findMany({
      where: {
        pointDeVenteId: pdvId,
        statut: "ACTIF",
        lignes: { some: { statut: "EN_ATTENTE" } },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        reference: true,
        statut: true,
        montantTotal: true,
        createdAt: true,
        client: { select: { id: true, nom: true, prenom: true, telephone: true } },
        creePar: { select: { id: true, nom: true, prenom: true } },
        lignes: {
          where: { statut: "EN_ATTENTE" },
          select: {
            id: true,
            produitNom: true,
            quantite: true,
            statut: true,
            estNouveauProduit: true,
            produit: { select: { id: true, nom: true, unite: true } },
          },
          orderBy: { id: "asc" },
        },
      },
    });

    const data = credits.map((c) => ({
      id:           c.id,
      reference:    c.reference,
      statut:       c.statut,
      montantTotal: Number(c.montantTotal),
      createdAt:    c.createdAt.toISOString(),
      client:       c.client
        ? { id: c.client.id, nom: `${c.client.prenom} ${c.client.nom}`, telephone: c.client.telephone }
        : null,
      creePar: c.creePar ? `${c.creePar.prenom} ${c.creePar.nom}` : null,
      lignesEnAttente: c.lignes.map((l) => ({
        id:               l.id,
        produitNom:       l.produitNom,
        quantite:         l.quantite,
        statut:           l.statut,
        estNouveauProduit: l.estNouveauProduit,
        unite:            l.produit?.unite ?? null,
      })),
    }));

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    console.error("GET /api/magasinier/credits:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
