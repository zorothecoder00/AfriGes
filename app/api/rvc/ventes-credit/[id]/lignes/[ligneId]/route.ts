import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";

type Ctx = { params: Promise<{ id: string; ligneId: string }> };

/**
 * PATCH /api/rvc/ventes-credit/[id]/lignes/[ligneId]
 *
 * Modifier une ligne : quantite, prixUnitaire, ou substituer le produit (produitId).
 * Cas possibles :
 *  - Changer quantite d'un produit catalogue → ajuste quantiteReservee
 *  - Substituer hors-catalogue → ajouter produitId (supprime produitNom, réserve stock)
 *  - Modifier prix d'une ligne hors catalogue
 *
 * Body: { quantite?, prixUnitaire?, produitId? }
 *
 * ---
 *
 * DELETE /api/rvc/ventes-credit/[id]/lignes/[ligneId]
 *
 * Supprimer une ligne.
 * → Libère la réservation stock si produit catalogue
 * → Interdit si c'est la dernière ligne
 * → Recalcule montantTotal
 */

async function resolveRvcPdvId(rvcId: number, isAdmin: boolean): Promise<number | null> {
  if (isAdmin) return null;
  const aff = await prisma.gestionnaireAffectation.findFirst({
    where: { userId: rvcId, actif: true },
    select: { pointDeVenteId: true },
  });
  return aff?.pointDeVenteId ?? null;
}

async function getVenteAndLigne(venteId: number, ligneId: number, rvcPdvId: number | null) {
  const vente = await prisma.venteDirecte.findUnique({
    where: { id: venteId },
    select: { id: true, statut: true, pointDeVenteId: true },
  });
  if (!vente) return { error: "Vente introuvable", status: 404 };
  if (rvcPdvId !== null && vente.pointDeVenteId !== rvcPdvId) return { error: "Accès refusé", status: 403 };
  if (vente.statut !== "CREDIT_REQUEST") return { error: "Seules les ventes en CREDIT_REQUEST peuvent être modifiées", status: 409 };

  const ligne = await prisma.ligneVenteDirecte.findFirst({
    where: { id: ligneId, venteId },
  });
  if (!ligne) return { error: "Ligne introuvable", status: 404 };

  return { vente, ligne };
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, ligneId } = await params;
    const venteId  = parseInt(id);
    const ligneIdN = parseInt(ligneId);
    if (isNaN(venteId) || isNaN(ligneIdN)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const rvcId   = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const rvcPdvId = await resolveRvcPdvId(rvcId, isAdmin);
    if (!isAdmin && rvcPdvId === null) return NextResponse.json({ error: "Aucun PDV associé au RVC" }, { status: 400 });

    const resolved = await getVenteAndLigne(venteId, ligneIdN, rvcPdvId);
    if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    const { vente, ligne } = resolved;
    const pdvId = vente.pointDeVenteId;

    const body = await req.json();
    const { quantite, prixUnitaire, produitId } = body as {
      quantite?: number;
      prixUnitaire?: number;
      produitId?: number;
    };

    const newQuantite  = quantite    ? Number(quantite)    : ligne.quantite;
    let newPrix        = prixUnitaire ? Number(prixUnitaire) : Number(ligne.prixUnitaire);
    const newProduitId = produitId    ? Number(produitId)   : ligne.produitId;
    let newProduitNom  = ligne.produitNom;

    // Substitution hors-catalogue → catalogue
    if (produitId && !ligne.produitId) {
      const stock = await prisma.stockSite.findUnique({
        where: { produitId_pointDeVenteId: { produitId: Number(produitId), pointDeVenteId: pdvId } },
        include: { produit: { select: { nom: true, prixUnitaire: true } } },
      });
      const dispo = (stock?.quantite ?? 0) - (stock?.quantiteReservee ?? 0);
      if (!stock || dispo < newQuantite) {
        return NextResponse.json(
          { error: `Stock insuffisant pour "${stock?.produit.nom ?? `produit #${produitId}`}". Disponible : ${Math.max(0, dispo)}` },
          { status: 400 }
        );
      }
      newPrix      = prixUnitaire ? Number(prixUnitaire) : Number(stock.produit.prixUnitaire);
      newProduitNom = null; // produit identifié → on supprime le nom libre
    }

    // Changement de quantité sur produit catalogue existant
    if (!produitId && ligne.produitId && quantite) {
      const stock = await prisma.stockSite.findUnique({
        where: { produitId_pointDeVenteId: { produitId: ligne.produitId, pointDeVenteId: pdvId } },
        select: { quantite: true, quantiteReservee: true },
      });
      const delta     = newQuantite - ligne.quantite; // peut être négatif
      const dispoApres = (stock?.quantite ?? 0) - (stock?.quantiteReservee ?? 0) - delta;
      if (dispoApres < 0) {
        return NextResponse.json({ error: "Stock insuffisant pour augmenter la quantité" }, { status: 400 });
      }
    }

    const newMontant = newQuantite * newPrix;

    const result = await prisma.$transaction(async (tx) => {
      // Ajuster réservation stock si quantite change ou si substitution
      if (ligne.produitId) {
        const delta = newQuantite - ligne.quantite;
        if (delta !== 0) {
          await tx.stockSite.update({
            where: { produitId_pointDeVenteId: { produitId: ligne.produitId, pointDeVenteId: pdvId } },
            data:  { quantiteReservee: delta > 0 ? { increment: delta } : { decrement: -delta } },
          });
        }
      } else if (produitId) {
        // Hors-catalogue substitué → réserver le nouveau produit
        await tx.stockSite.update({
          where: { produitId_pointDeVenteId: { produitId: Number(produitId), pointDeVenteId: pdvId } },
          data:  { quantiteReservee: { increment: newQuantite } },
        });
      }

      const updated = await tx.ligneVenteDirecte.update({
        where: { id: ligneIdN },
        data: {
          produitId:   newProduitId,
          produitNom:  newProduitNom,
          quantite:    newQuantite,
          prixUnitaire: newPrix,
          montant:     newMontant,
        },
      });

      // Recalculer montantTotal
      const toutes = await tx.ligneVenteDirecte.findMany({
        where:  { venteId },
        select: { montant: true },
      });
      const newTotal = toutes.reduce((s, l) => s + Number(l.montant), 0);
      await tx.venteDirecte.update({ where: { id: venteId }, data: { montantTotal: newTotal } });

      return { ligne: updated, montantTotal: newTotal };
    });

    return NextResponse.json({ data: result.ligne, montantTotal: result.montantTotal });
  } catch (error) {
    console.error("PATCH /api/rvc/ventes-credit/[id]/lignes/[ligneId]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, ligneId } = await params;
    const venteId  = parseInt(id);
    const ligneIdN = parseInt(ligneId);
    if (isNaN(venteId) || isNaN(ligneIdN)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const rvcId   = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const rvcPdvId = await resolveRvcPdvId(rvcId, isAdmin);
    if (!isAdmin && rvcPdvId === null) return NextResponse.json({ error: "Aucun PDV associé au RVC" }, { status: 400 });

    const resolved = await getVenteAndLigne(venteId, ligneIdN, rvcPdvId);
    if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    const { vente, ligne } = resolved;
    const pdvId = vente.pointDeVenteId;

    // Interdire suppression de la dernière ligne
    const count = await prisma.ligneVenteDirecte.count({ where: { venteId } });
    if (count <= 1) {
      return NextResponse.json({ error: "Impossible de supprimer la dernière ligne. Refusez la vente à la place." }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.ligneVenteDirecte.delete({ where: { id: ligneIdN } });

      // Libérer la réservation si produit catalogue
      if (ligne.produitId) {
        await tx.stockSite.update({
          where: { produitId_pointDeVenteId: { produitId: ligne.produitId, pointDeVenteId: pdvId } },
          data:  { quantiteReservee: { decrement: ligne.quantite } },
        });
      }

      // Recalculer montantTotal
      const toutes = await tx.ligneVenteDirecte.findMany({
        where:  { venteId },
        select: { montant: true },
      });
      const newTotal = toutes.reduce((s, l) => s + Number(l.montant), 0);
      await tx.venteDirecte.update({ where: { id: venteId }, data: { montantTotal: newTotal } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/rvc/ventes-credit/[id]/lignes/[ligneId]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
