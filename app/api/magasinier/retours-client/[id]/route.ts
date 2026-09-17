import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

type Ctx = { params: Promise<{ id: string }> };

const INCLUDE = {
  lignes: { include: { produit: { select: { id: true, nom: true, codeProduit: true } } } },
  reclamation: { select: { id: true, numero: true, objet: true, client: { select: { nom: true, prenom: true } } } },
  magasinier: { select: { id: true, nom: true, prenom: true } },
  pointDeVente: { select: { id: true, nom: true, code: true } },
};

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const retour = await prisma.retourMarchandiseClient.findUnique({ where: { id: Number(id) }, include: INCLUDE });
    if (!retour) return NextResponse.json({ error: "Retour introuvable" }, { status: 404 });
    return NextResponse.json({ data: retour });
  } catch (error) {
    console.error("GET /magasinier/retours-client/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/magasinier/retours-client/[id]
 * Body: { action: "RECEPTIONNER" } — atteste la réception physique
 *     | { action: "VALIDER" } — devient le "Bon de retour" : génère l'entrée
 *       de stock RETOUR_CLIENT (StockSite + MouvementStock)
 *     | { action: "REJETER", motifRejet }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const retourId = Number(id);
    const retour = await prisma.retourMarchandiseClient.findUnique({
      where: { id: retourId },
      include: { lignes: true, reclamation: { select: { id: true, numero: true } } },
    });
    if (!retour) return NextResponse.json({ error: "Retour introuvable" }, { status: 404 });
    if (retour.statut === "VALIDE" || retour.statut === "REJETE") {
      return NextResponse.json({ error: "Ce retour est déjà clos" }, { status: 409 });
    }

    const body = await req.json();
    const action = body.action as string;
    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);

    if (action === "RECEPTIONNER") {
      if (retour.statut !== "DECLARE") return NextResponse.json({ error: "Le retour doit être au statut Déclaré" }, { status: 409 });
      const r = await prisma.$transaction(async (tx) => {
        const updated = await tx.retourMarchandiseClient.update({
          where: { id: retourId },
          data: { statut: "RECEPTIONNE", magasinierId: userId, dateReception: new Date() },
          include: INCLUDE,
        });
        await auditLog(tx, userId, "RETOUR_MARCHANDISE_RECEPTIONNE", "RetourMarchandiseClient", retourId, undefined, meta);
        return updated;
      });
      return NextResponse.json({ data: r });
    }

    if (action === "VALIDER") {
      if (retour.statut !== "RECEPTIONNE") return NextResponse.json({ error: "Le retour doit être réceptionné avant validation" }, { status: 409 });
      const r = await prisma.$transaction(async (tx) => {
        let dernierMouvementId: number | null = null;
        for (const ligne of retour.lignes) {
          await tx.stockSite.upsert({
            where: { produitId_pointDeVenteId: { produitId: ligne.produitId, pointDeVenteId: retour.pointDeVenteId } },
            update: { quantite: { increment: ligne.quantite } },
            create: { produitId: ligne.produitId, pointDeVenteId: retour.pointDeVenteId, quantite: ligne.quantite },
          });
          const mvt = await tx.mouvementStock.create({
            data: {
              produitId: ligne.produitId,
              pointDeVenteId: retour.pointDeVenteId,
              type: "ENTREE",
              typeEntree: "RETOUR_CLIENT",
              quantite: ligne.quantite,
              motif: `Retour marchandise ${retour.numero} — réclamation ${retour.reclamation.numero}`,
              reference: `${retour.numero}-P${ligne.produitId}`,
              operateurId: userId,
            },
          });
          dernierMouvementId = mvt.id;
        }
        const updated = await tx.retourMarchandiseClient.update({
          where: { id: retourId },
          data: { statut: "VALIDE", mouvementStockId: dernierMouvementId },
          include: INCLUDE,
        });
        await tx.actionReclamation.create({
          data: { reclamationId: retour.reclamation.id, type: "RETOUR_ORGANISE", description: `Bon de retour ${retour.numero} validé (entrée en stock)`, auteurId: userId },
        });
        await auditLog(tx, userId, "RETOUR_MARCHANDISE_VALIDE", "RetourMarchandiseClient", retourId, undefined, meta);
        await notifyRoles(tx, ["RESPONSABLE_POINT_DE_VENTE"], {
          titre: `Bon de retour validé — ${retour.numero}`,
          message: `Le magasinier a validé le retour de marchandise (réclamation ${retour.reclamation.numero}) : stock recrédité.`,
          priorite: "NORMAL",
          actionUrl: `/dashboard/admin/reclamations?detail=${retour.reclamation.id}`,
        });
        return updated;
      });
      return NextResponse.json({ data: r });
    }

    if (action === "REJETER") {
      if (!body.motifRejet || !String(body.motifRejet).trim()) return NextResponse.json({ error: "Le motif de rejet est obligatoire" }, { status: 400 });
      const r = await prisma.$transaction(async (tx) => {
        const updated = await tx.retourMarchandiseClient.update({
          where: { id: retourId },
          data: { statut: "REJETE", magasinierId: userId, motifRejet: String(body.motifRejet).trim() },
          include: INCLUDE,
        });
        await auditLog(tx, userId, "RETOUR_MARCHANDISE_REJETE", "RetourMarchandiseClient", retourId, { motif: body.motifRejet }, meta);
        return updated;
      });
      return NextResponse.json({ data: r });
    }

    return NextResponse.json({ error: "Action non reconnue" }, { status: 400 });
  } catch (error) {
    console.error("PATCH /magasinier/retours-client/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
