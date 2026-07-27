import { NextResponse } from "next/server";
import { Prisma, TypeMouvement } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { auditLog } from "@/lib/notifications";
import { randomUUID } from "crypto";
import { getRequestMeta } from "@/lib/requestMeta";

/**
 * GET /api/admin/stock/[id]
 * Detail d'un produit avec ses mouvements    
 */
export async function GET(
  req: Request,   
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session || !session.user.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { id } = await context.params;
    const numericId = Number(id);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const produit = await prisma.produit.findUnique({
      where: { id: numericId },
      include: {
        stocks: { include: { pointDeVente: { select: { id: true, nom: true, code: true } } } },
        mouvements: {
          orderBy: { dateMouvement: "desc" },
          take: 50,
        },
      },
    });

    if (!produit) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }

    // ✅ CALCUL DU STOCK TOTAL
    const totalStock = produit.stocks.reduce(
      (sum, s) => sum + s.quantite,
      0
    );

    // ✅ FORMAT POUR LE FRONT
    const formattedProduit = {
      id: produit.id,
      nom: produit.nom,
      description: produit.description,
      prixUnitaire: produit.prixUnitaire.toString(),
      prixAchat: produit.prixAchat ? produit.prixAchat.toString() : null,
      stock: totalStock,
      alerteStock: produit.alerteStock,
      createdAt: produit.createdAt,
      updatedAt: produit.updatedAt,
      mouvements: produit.mouvements || [],
    };

    return NextResponse.json({ data: formattedProduit });
  } catch (error) {
    console.error("GET /admin/stock/[id] error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la recuperation du produit" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/stock/[id]
 * Mettre a jour un produit (infos + ajustement stock optionnel)
 */
export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session || !session.user.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { id } = await context.params;
    const numericId = Number(id);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const body = await req.json();
    const { nom, description, prixUnitaire, prixAchat, alerteStock, ajustementStock, motifAjustement, pointDeVenteId, blocageAction, blocageQuantite } = body;

    const existing = await prisma.produit.findUnique({ where: { id: numericId } });
    if (!existing) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }

    const produit = await prisma.$transaction(async (tx) => {
      const updateData: Prisma.ProduitUpdateInput = {};

      if (nom !== undefined) updateData.nom = nom;
      if (description !== undefined) updateData.description = description;
      if (prixUnitaire !== undefined) updateData.prixUnitaire = new Prisma.Decimal(prixUnitaire);
      if (prixAchat !== undefined) {
        updateData.prixAchat =
          prixAchat === null || prixAchat === ""
            ? null
            : new Prisma.Decimal(prixAchat);
      }
      if (alerteStock !== undefined) updateData.alerteStock = Number(alerteStock);

      // Ajustement de stock via StockSite
      if (ajustementStock !== undefined && ajustementStock !== 0) {
        const qty = Number(ajustementStock);

        let type: TypeMouvement;
        if (qty > 0) type = "ENTREE";
        else if (qty < 0) type = "SORTIE";
        else type = "AJUSTEMENT";

        if (qty > 0) {
          // ENTREE : nécessite un PDV cible
          if (!pointDeVenteId) throw new Error("pointDeVenteId requis pour un ajustement positif");
          await tx.stockSite.upsert({
            where: { produitId_pointDeVenteId: { produitId: numericId, pointDeVenteId: Number(pointDeVenteId) } },
            update: { quantite: { increment: qty } },
            create: { produitId: numericId, pointDeVenteId: Number(pointDeVenteId), quantite: qty },
          });
        } else {
          // SORTIE : décrémentation greedy
          const sites = await tx.stockSite.findMany({
            where: { produitId: numericId, quantite: { gt: 0 } },
            orderBy: { quantite: "desc" },
          });
          const totalDispo = sites.reduce((s, ss) => s + ss.quantite - ss.quantiteReservee, 0);
          if (Math.abs(qty) > totalDispo) throw new Error("Le stock disponible (hors réservations) est insuffisant");
          let remaining = Math.abs(qty);
          for (const site of sites) {
            if (remaining <= 0) break;
            const dispo = site.quantite - site.quantiteReservee;
            if (dispo <= 0) continue;
            const dec = Math.min(dispo, remaining);
            await tx.stockSite.update({ where: { id: site.id }, data: { quantite: { decrement: dec } } });
            remaining -= dec;
          }
        }

        await tx.mouvementStock.create({
          data: {
            produitId:      numericId,
            pointDeVenteId: pointDeVenteId ? Number(pointDeVenteId) : null,
            type,
            quantite:       Math.abs(qty),
            motif:          motifAjustement || "Ajustement manuel",
            reference:      `ADJ-${randomUUID()}`,
            operateurId:    parseInt(session.user.id),
          },
        });
      }

      // Blocage qualité / consignation (CDC §11) — transfert interne au site, sans
      // impact sur la quantité totale théorique (juste un changement de disponibilité).
      if (blocageAction && blocageQuantite) {
        if (!pointDeVenteId) throw new Error("pointDeVenteId requis pour un blocage/consignation");
        const qty = Math.abs(Number(blocageQuantite));
        const site = await tx.stockSite.findUnique({
          where: { produitId_pointDeVenteId: { produitId: numericId, pointDeVenteId: Number(pointDeVenteId) } },
        });
        if (!site) throw new Error("Aucun stock sur ce site pour ce produit");

        if (blocageAction === "BLOQUER") {
          if (site.quantite < qty) throw new Error("Stock disponible insuffisant pour bloquer cette quantité");
          await tx.stockSite.update({ where: { id: site.id }, data: { quantite: { decrement: qty }, quantiteBloquee: { increment: qty } } });
        } else if (blocageAction === "DEBLOQUER") {
          if (site.quantiteBloquee < qty) throw new Error("Quantité bloquée insuffisante");
          await tx.stockSite.update({ where: { id: site.id }, data: { quantite: { increment: qty }, quantiteBloquee: { decrement: qty } } });
        } else if (blocageAction === "CONSIGNER") {
          if (site.quantite < qty) throw new Error("Stock disponible insuffisant pour consigner cette quantité");
          await tx.stockSite.update({ where: { id: site.id }, data: { quantite: { decrement: qty }, quantiteConsignee: { increment: qty } } });
        } else if (blocageAction === "DECONSIGNER") {
          if (site.quantiteConsignee < qty) throw new Error("Quantité consignée insuffisante");
          await tx.stockSite.update({ where: { id: site.id }, data: { quantite: { increment: qty }, quantiteConsignee: { decrement: qty } } });
        } else {
          throw new Error("blocageAction invalide");
        }

        await auditLog(tx, parseInt(session.user.id), `STOCK_${blocageAction}`, "StockSite", site.id, { produitId: numericId, pointDeVenteId: Number(pointDeVenteId), quantite: qty, motif: motifAjustement || null }, getRequestMeta(req));
      }

      return tx.produit.update({
        where: { id: numericId },
        data: updateData,
      });
    });

    return NextResponse.json({ data: produit });
  } catch (error: unknown) {
    console.error("PUT /admin/stock/[id] error:", error);

    const messagesConnus = [
      "Le stock disponible (hors réservations) est insuffisant",
      "pointDeVenteId requis pour un ajustement positif",
      "pointDeVenteId requis pour un blocage/consignation",
      "Aucun stock sur ce site pour ce produit",
      "Stock disponible insuffisant pour bloquer cette quantité",
      "Quantité bloquée insuffisante",
      "Stock disponible insuffisant pour consigner cette quantité",
      "Quantité consignée insuffisante",
      "blocageAction invalide",
    ];
    if (error instanceof Error && messagesConnus.includes(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Erreur lors de la mise a jour du produit" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/stock/[id]
 * Supprimer un produit (uniquement si pas de ventes liees)
 */
export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session || !session.user.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { id } = await context.params;
    const numericId = Number(id);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    // Interdiction 11.2 : aucune suppression d'historique — soft delete uniquement
    const stockActif = await prisma.stockSite.findFirst({
      where: { produitId: numericId, quantite: { gt: 0 } },
    });
    if (stockActif) {
      return NextResponse.json(
        { error: "Impossible de désactiver un produit avec du stock. Ajustez le stock à 0 d'abord." },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.produit.update({ where: { id: numericId }, data: { actif: false } });
      await auditLog(tx, parseInt(session.user.id), "PRODUIT_DESACTIVE", "Produit", numericId);
    });

    return NextResponse.json({ message: "Produit désactivé" });
  } catch (error) {
    console.error("DELETE /admin/stock/[id] error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du produit" },
      { status: 500 }
    );
  }
}
