import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/rvc/ventes-credit/[id]
 * Détail d'une demande de vente à crédit avec toutes ses lignes (catalogue + hors catalogue).
 * Accessible tant que la vente est en CREDIT_REQUEST.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const venteId = parseInt(id);
    if (isNaN(venteId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    let rvcPdvId: number | null = null;
    if (!isAdmin) {
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId: parseInt(session.user.id), actif: true },
        select: { pointDeVenteId: true },
      });
      rvcPdvId = aff?.pointDeVenteId ?? null;
    }

    const vente = await prisma.venteDirecte.findUnique({
      where: { id: venteId },
      include: {
        vendeur:      { select: { id: true, nom: true, prenom: true } },
        pointDeVente: { select: { id: true, nom: true } },
        client:       {
          select: {
            id: true, nom: true, prenom: true, telephone: true,
            limiteCredit: true, soldeActuel: true,
          },
        },
        creditClient: {
          select: {
            id: true, reference: true, statut: true,
            montantTotal: true, montantConsomme: true,
            dureeJours: true, dateDebut: true,
          },
        },
        lignes: {
          include: {
            produit: { select: { id: true, nom: true, unite: true, prixUnitaire: true } },
          },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!vente) return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });
    if (rvcPdvId !== null && vente.pointDeVenteId !== rvcPdvId) {
      return NextResponse.json({ error: "Accès refusé à cette vente" }, { status: 403 });
    }

    // Produits du catalogue disponibles pour substitution
    const produitsCatalogue = await prisma.stockSite.findMany({
      where: { pointDeVenteId: vente.pointDeVenteId, quantite: { gt: 0 } },
      include: { produit: { select: { id: true, nom: true, unite: true, prixUnitaire: true } } },
      orderBy: { produit: { nom: "asc" } },
    });

    return NextResponse.json({
      data: {
        ...vente,
        montantTotal:  Number(vente.montantTotal),
        montantPaye:   Number(vente.montantPaye),
        creditClient:  vente.creditClient
          ? {
              ...vente.creditClient,
              montantTotal:    Number(vente.creditClient.montantTotal),
              montantConsomme: Number(vente.creditClient.montantConsomme),
              soldeDisponible: Number(vente.creditClient.montantTotal) - Number(vente.creditClient.montantConsomme),
            }
          : null,
        lignes: vente.lignes.map((l) => ({
          id:           l.id,
          produitId:    l.produitId,
          produitNom:   l.produitId ? l.produit?.nom : l.produitNom,
          unite:        l.produit?.unite ?? null,
          prixUnitaire: Number(l.prixUnitaire),
          quantite:     l.quantite,
          montant:      Number(l.montant),
          horscatalogue: !l.produitId,
        })),
      },
      produitsCatalogue: produitsCatalogue.map((s) => ({
        id:           s.produit.id,
        nom:          s.produit.nom,
        unite:        s.produit.unite,
        prixUnitaire: Number(s.produit.prixUnitaire),
        stock:        s.quantite - s.quantiteReservee,
      })),
      editable: vente.statut === "CREDIT_REQUEST",
    });
  } catch (error) {
    console.error("GET /api/rvc/ventes-credit/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
