import { NextResponse } from "next/server";
import { Prisma, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";
import { notifyRoles, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/rpv/produits/[id] — Détail produit + stocks par site + 30 derniers mouvements */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { id: idStr } = await params;
    const produit = await prisma.produit.findUnique({
      where: { id: Number(idStr) },
      include: {
        stocks: { select: { quantite: true, pointDeVenteId: true } },
        mouvements: {
          orderBy: { dateMouvement: "desc" },
          take: 30,
        },
      },
    });
    if (!produit) return NextResponse.json({ message: "Produit introuvable" }, { status: 404 });

    const totalStock = produit.stocks.reduce((s, ss) => s + ss.quantite, 0);

    return NextResponse.json({
      success: true,
      data: { ...produit, totalStock, prixUnitaire: Number(produit.prixUnitaire) },
    });
  } catch (error) {
    console.error("GET /api/rpv/produits/[id] error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PUT /api/rpv/produits/[id] — Mise à jour fiche produit (nom, description, alerteStock).
 * Prix de vente et prix d'achat : réservés à Admin / Logistique.
 * Ajustements de stock : réservés au Magasinier.
 */
export async function PUT(req: Request, { params }: Ctx) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { id: idStr } = await params;
    const id = Number(idStr);
    const produitExistant = await prisma.produit.findUnique({ where: { id } });
    if (!produitExistant) return NextResponse.json({ message: "Produit introuvable" }, { status: 404 });

    const { nom, description, alerteStock } = await req.json();

    const updateData: Prisma.ProduitUpdateInput = {};
    if (nom         !== undefined) updateData.nom         = nom;
    if (description !== undefined) updateData.description = description ?? null;
    if (alerteStock !== undefined) updateData.alerteStock = Number(alerteStock);

    const produit = await prisma.$transaction(async (tx) => {
      const updated = await tx.produit.update({ where: { id }, data: updateData });

      await notifyRoles(tx, ["MAGAZINIER", "AGENT_LOGISTIQUE_APPROVISIONNEMENT"], {
        titre:    `Produit modifié : ${produitExistant.nom}`,
        message:  `${session.user.name ?? "RPV"} a mis à jour la fiche du produit "${produitExistant.nom}".`,
        priorite: PrioriteNotification.BASSE,
        actionUrl: `/dashboard/admin/stock/${id}`,
      });

      await auditLog(tx, parseInt(session.user.id), "MODIFICATION_PRODUIT_RPV", "Produit", id);

      return updated;
    });

    return NextResponse.json({
      success: true,
      message: "Produit mis à jour",
      data: { ...produit, prixUnitaire: Number(produit.prixUnitaire) },
    });
  } catch (error) {
    console.error("PUT /api/rpv/produits/[id] error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}

/** DELETE /api/rpv/produits/[id] — Interdit : réservé à Admin / Logistique */
export async function DELETE() {
  return NextResponse.json(
    { message: "La suppression de produits est réservée à l'Admin et au Responsable Approvisionnement" },
    { status: 403 }
  );
}
