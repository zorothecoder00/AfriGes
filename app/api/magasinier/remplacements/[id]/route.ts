import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

type Ctx = { params: Promise<{ id: string }> };

const INCLUDE = {
  produitOrigine: { select: { id: true, nom: true, codeProduit: true } },
  produitRemplacement: { select: { id: true, nom: true, codeProduit: true } },
  reclamation: { select: { id: true, numero: true, client: { select: { nom: true, prenom: true } } } },
  magasinier: { select: { id: true, nom: true, prenom: true } },
};

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const remplacement = await prisma.remplacementProduit.findUnique({ where: { id: Number(id) }, include: INCLUDE });
    if (!remplacement) return NextResponse.json({ error: "Remplacement introuvable" }, { status: 404 });
    return NextResponse.json({ data: remplacement });
  } catch (error) {
    console.error("GET /magasinier/remplacements/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/magasinier/remplacements/[id]
 * Body: { action: "APPROUVER" }
 *     | { action: "LIVRER" } — sortie de stock REMPLACEMENT_CLIENT du produit de remplacement
 *     | { action: "REJETER", motifRejet }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const remplacementId = Number(id);
    const remplacement = await prisma.remplacementProduit.findUnique({
      where: { id: remplacementId },
      include: { reclamation: { select: { id: true, numero: true } } },
    });
    if (!remplacement) return NextResponse.json({ error: "Remplacement introuvable" }, { status: 404 });
    if (remplacement.statut === "LIVRE" || remplacement.statut === "REJETE") {
      return NextResponse.json({ error: "Ce remplacement est déjà clos" }, { status: 409 });
    }

    const body = await req.json();
    const action = body.action as string;
    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);

    if (action === "APPROUVER") {
      if (remplacement.statut !== "DEMANDE") return NextResponse.json({ error: "Le remplacement doit être au statut Demandé" }, { status: 409 });
      const r = await prisma.$transaction(async (tx) => {
        const updated = await tx.remplacementProduit.update({
          where: { id: remplacementId },
          data: { statut: "APPROUVE", magasinierId: userId },
          include: INCLUDE,
        });
        await auditLog(tx, userId, "REMPLACEMENT_PRODUIT_APPROUVE", "RemplacementProduit", remplacementId, undefined, meta);
        return updated;
      });
      return NextResponse.json({ data: r });
    }

    if (action === "LIVRER") {
      if (remplacement.statut !== "APPROUVE") return NextResponse.json({ error: "Le remplacement doit être approuvé avant livraison" }, { status: 409 });

      const stock = await prisma.stockSite.findUnique({
        where: { produitId_pointDeVenteId: { produitId: remplacement.produitRemplacementId, pointDeVenteId: remplacement.pointDeVenteId } },
        select: { quantite: true },
      });
      if (!stock || stock.quantite < remplacement.quantite) {
        return NextResponse.json({ error: "Stock insuffisant pour le produit de remplacement" }, { status: 409 });
      }

      const r = await prisma.$transaction(async (tx) => {
        await tx.stockSite.update({
          where: { produitId_pointDeVenteId: { produitId: remplacement.produitRemplacementId, pointDeVenteId: remplacement.pointDeVenteId } },
          data: { quantite: { decrement: remplacement.quantite } },
        });
        const mvt = await tx.mouvementStock.create({
          data: {
            produitId: remplacement.produitRemplacementId,
            pointDeVenteId: remplacement.pointDeVenteId,
            type: "SORTIE",
            typeSortie: "REMPLACEMENT_CLIENT",
            quantite: remplacement.quantite,
            motif: `Remplacement ${remplacement.numero} — réclamation ${remplacement.reclamation.numero}`,
            reference: `${remplacement.numero}-SORTIE`,
            operateurId: userId,
          },
        });
        const updated = await tx.remplacementProduit.update({
          where: { id: remplacementId },
          data: { statut: "LIVRE", dateLivraison: new Date(), mouvementSortieId: mvt.id },
          include: INCLUDE,
        });
        await tx.actionReclamation.create({
          data: { reclamationId: remplacement.reclamation.id, type: "REMPLACEMENT_ORGANISE", description: `Bon de remplacement ${remplacement.numero} livré`, auteurId: userId },
        });
        await auditLog(tx, userId, "REMPLACEMENT_PRODUIT_LIVRE", "RemplacementProduit", remplacementId, undefined, meta);
        await notifyRoles(tx, ["RESPONSABLE_POINT_DE_VENTE"], {
          titre: `Remplacement livré — ${remplacement.numero}`,
          message: `Le magasinier a livré le produit de remplacement (réclamation ${remplacement.reclamation.numero}).`,
          priorite: "NORMAL",
          actionUrl: `/dashboard/admin/reclamations?detail=${remplacement.reclamation.id}`,
        });
        return updated;
      });
      return NextResponse.json({ data: r });
    }

    if (action === "REJETER") {
      if (!body.motifRejet || !String(body.motifRejet).trim()) return NextResponse.json({ error: "Le motif de rejet est obligatoire" }, { status: 400 });
      const r = await prisma.$transaction(async (tx) => {
        const updated = await tx.remplacementProduit.update({
          where: { id: remplacementId },
          data: { statut: "REJETE", magasinierId: userId, motifRejet: String(body.motifRejet).trim() },
          include: INCLUDE,
        });
        await auditLog(tx, userId, "REMPLACEMENT_PRODUIT_REJETE", "RemplacementProduit", remplacementId, { motif: body.motifRejet }, meta);
        return updated;
      });
      return NextResponse.json({ data: r });
    }

    return NextResponse.json({ error: "Action non reconnue" }, { status: 400 });
  } catch (error) {
    console.error("PATCH /magasinier/remplacements/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
