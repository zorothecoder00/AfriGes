import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/rvc/ventes-credit/[id]/lignes
 *
 * Le RVC ajoute une ligne à une vente en CREDIT_REQUEST.
 *
 * Body (produit catalogue) : { produitId: number, quantite: number, prixUnitaire?: number }
 * Body (hors catalogue)    : { produitNom: string, quantite: number, prixUnitaire: number }
 *
 * → Réserve le stock si produit catalogue
 * → Recalcule montantTotal de la vente
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const venteId = parseInt(id);
    if (isNaN(venteId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const rvcId   = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    let rvcPdvId: number | null = null;
    if (!isAdmin) {
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId: rvcId, actif: true },
        select: { pointDeVenteId: true },
      });
      if (!aff) return NextResponse.json({ error: "Aucun point de vente associé au RVC" }, { status: 400 });
      rvcPdvId = aff.pointDeVenteId;
    }

    const vente = await prisma.venteDirecte.findUnique({
      where: { id: venteId },
      select: {
        id: true, statut: true, pointDeVenteId: true, montantTotal: true,
        lignes: { select: { montant: true } },
      },
    });

    if (!vente) return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });
    if (rvcPdvId !== null && vente.pointDeVenteId !== rvcPdvId) {
      return NextResponse.json({ error: "Cette vente n'appartient pas à votre point de vente" }, { status: 403 });
    }
    if (vente.statut !== "CREDIT_REQUEST") {
      return NextResponse.json({ error: "Seules les ventes en CREDIT_REQUEST peuvent être modifiées" }, { status: 409 });
    }

    const pdvId = vente.pointDeVenteId;
    const body  = await req.json();
    const { produitId, produitNom, quantite, prixUnitaire } = body as {
      produitId?: number;
      produitNom?: string;
      quantite: number;
      prixUnitaire?: number;
    };

    const qte = Number(quantite);
    if (!qte || qte <= 0) return NextResponse.json({ error: "Quantité invalide" }, { status: 400 });

    let ligneData: { produitId: number | null; produitNom: string | null; quantite: number; prixUnitaire: number; montant: number };
    let reserverStock = false;

    if (produitId) {
      // Produit catalogue
      const stock = await prisma.stockSite.findUnique({
        where: { produitId_pointDeVenteId: { produitId: Number(produitId), pointDeVenteId: pdvId } },
        include: { produit: { select: { nom: true, prixUnitaire: true } } },
      });
      const dispo = (stock?.quantite ?? 0) - (stock?.quantiteReservee ?? 0);
      if (!stock || dispo < qte) {
        return NextResponse.json(
          { error: `Stock insuffisant pour "${stock?.produit.nom ?? `produit #${produitId}`}". Disponible : ${Math.max(0, dispo)}` },
          { status: 400 }
        );
      }
      const prix = prixUnitaire ? Number(prixUnitaire) : Number(stock.produit.prixUnitaire);
      ligneData    = { produitId: Number(produitId), produitNom: null, quantite: qte, prixUnitaire: prix, montant: qte * prix };
      reserverStock = true;
    } else {
      // Hors catalogue
      if (!produitNom?.trim()) return NextResponse.json({ error: "produitNom requis pour un produit hors catalogue" }, { status: 400 });
      if (!prixUnitaire || Number(prixUnitaire) <= 0) return NextResponse.json({ error: "prixUnitaire requis pour un produit hors catalogue" }, { status: 400 });
      const prix = Number(prixUnitaire);
      ligneData    = { produitId: null, produitNom: produitNom.trim(), quantite: qte, prixUnitaire: prix, montant: qte * prix };
    }

    const result = await prisma.$transaction(async (tx) => {
      const ligne = await tx.ligneVenteDirecte.create({
        data: { venteId, ...ligneData },
      });

      if (reserverStock && ligneData.produitId) {
        await tx.stockSite.update({
          where: { produitId_pointDeVenteId: { produitId: ligneData.produitId, pointDeVenteId: pdvId } },
          data:  { quantiteReservee: { increment: qte } },
        });
      }

      // Recalculer montantTotal
      const toutes = await tx.ligneVenteDirecte.findMany({
        where:  { venteId },
        select: { montant: true },
      });
      const newTotal = toutes.reduce((s, l) => s + Number(l.montant), 0);
      await tx.venteDirecte.update({
        where: { id: venteId },
        data:  { montantTotal: newTotal },
      });

      return { ligne, newTotal };
    });

    return NextResponse.json({ data: result.ligne, montantTotal: result.newTotal }, { status: 201 });
  } catch (error) {
    console.error("POST /api/rvc/ventes-credit/[id]/lignes:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
