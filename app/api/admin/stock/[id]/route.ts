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
        mouvements: {
          orderBy: { dateMouvement: "desc" },
          take: 50,
        },
      },
    });

    if (!produit) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }

    return NextResponse.json({ data: produit });
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
    const { nom, description, prixUnitaire, alerteStock, ajustementStock, motifAjustement } = body;

    const existing = await prisma.produit.findUnique({ where: { id: numericId } });
    if (!existing) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }

    const produit = await prisma.$transaction(async (tx) => {
      const updateData: Prisma.ProduitUpdateInput = {};

      if (nom !== undefined) updateData.nom = nom;
      if (description !== undefined) updateData.description = description;
      if (prixUnitaire !== undefined) updateData.prixUnitaire = new Prisma.Decimal(prixUnitaire);
      if (alerteStock !== undefined) updateData.alerteStock = Number(alerteStock);

      // Ajustement de stock si demande
      if (ajustementStock !== undefined && ajustementStock !== 0) {
        const qty = Number(ajustementStock);
        const newStock = existing.stock + qty;

        if (newStock < 0) {
          throw new Error("Le stock ne peut pas etre negatif");
        }

        updateData.stock = newStock;

        let type: TypeMouvement;
        if (qty > 0) type = "ENTREE";
        else if (qty < 0) type = "SORTIE";
        else type = "AJUSTEMENT";

        await tx.mouvementStock.create({
          data: {
            produitId: numericId,
            type,
            quantite: Math.abs(qty),
            motif: motifAjustement || "Ajustement manuel",
            reference: `ADJ-${randomUUID()}`,
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

    // Verifier qu'il n'y a pas de ventes liees
    const ventesCount = await prisma.venteCreditAlimentaire.count({
      where: { produitId: numericId },
    });

    if (ventesCount > 0) {
      return NextResponse.json(
        { error: "Impossible de supprimer ce produit : des ventes y sont associees" },
        { status: 400 }
      );
    }

    // Supprimer les mouvements puis le produit
    await prisma.$transaction(async (tx) => {
      await tx.mouvementStock.deleteMany({ where: { produitId: numericId } });
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
