import { NextResponse } from "next/server";
import { Prisma, TypeMouvement } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { randomUUID } from "crypto";

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
    const { nom, description, prixUnitaire, prixAchat, alerteStock, ajustementStock, motifAjustement, pointDeVenteId } = body;

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
          const totalStock = sites.reduce((s, ss) => s + ss.quantite, 0);
          if (Math.abs(qty) > totalStock) throw new Error("Le stock ne peut pas etre negatif");
          let remaining = Math.abs(qty);
          for (const site of sites) {
            if (remaining <= 0) break;
            const dec = Math.min(site.quantite, remaining);
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
          },
        });
      }

      return tx.produit.update({
        where: { id: numericId },
        data: updateData,
      });
    });

    return NextResponse.json({ data: produit });
  } catch (error: unknown) {
    console.error("PUT /admin/stock/[id] error:", error);

    if (error instanceof Error && error.message === "Le stock ne peut pas etre negatif") {
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

    // Supprimer les mouvements, stocks par site puis le produit
    await prisma.$transaction(async (tx) => {
      await tx.mouvementStock.deleteMany({ where: { produitId: numericId } });
      await tx.stockSite.deleteMany({ where: { produitId: numericId } });
      await tx.produit.delete({ where: { id: numericId } });
    });

    return NextResponse.json({ message: "Produit supprime" });
  } catch (error) {
    console.error("DELETE /admin/stock/[id] error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du produit" },
      { status: 500 }
    );
  }
}
