import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";
import { randomUUID } from "crypto";

type Ctx = { params: { id: string } };

/** GET /api/rpv/produits/[id] — Détail produit + 30 derniers mouvements */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const produit = await prisma.produit.findUnique({
      where: { id: Number(params.id) },
      include: {
        mouvements: {
          orderBy: { dateMouvement: "desc" },
          take: 30,
        },
      },
    });
    if (!produit) return NextResponse.json({ message: "Produit introuvable" }, { status: 404 });

    return NextResponse.json({
      success: true,
      data: { ...produit, prixUnitaire: Number(produit.prixUnitaire) },
    });
  } catch (error) {
    console.error("GET /api/rpv/produits/[id] error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PUT /api/rpv/produits/[id] — Mise à jour produit.
 * Body : { nom?, description?, prixUnitaire?, alerteStock?,
 *          ajustementStock?, motifAjustement? }
 *
 * Si ajustementStock est fourni, un mouvement est créé.
 */
export async function PUT(req: Request, { params }: Ctx) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const id = Number(params.id);
    const produitExistant = await prisma.produit.findUnique({ where: { id } });
    if (!produitExistant) return NextResponse.json({ message: "Produit introuvable" }, { status: 404 });

    const { nom, description, prixUnitaire, alerteStock, ajustementStock, motifAjustement } = await req.json();

    const updateData: Prisma.ProduitUpdateInput = {};
    if (nom          !== undefined) updateData.nom          = nom;
    if (description  !== undefined) updateData.description  = description ?? null;
    if (prixUnitaire !== undefined) {
      if (Number(prixUnitaire) <= 0) return NextResponse.json({ message: "Prix invalide" }, { status: 400 });
      updateData.prixUnitaire = new Prisma.Decimal(Number(prixUnitaire));
    }
    if (alerteStock !== undefined) updateData.alerteStock = Number(alerteStock);

    const produit = await prisma.$transaction(async (tx) => {
      let updated = await tx.produit.update({ where: { id }, data: updateData });

      if (ajustementStock !== undefined && ajustementStock !== null && ajustementStock !== 0) {
        const delta    = Number(ajustementStock);
        const newStock = updated.stock + delta;
        if (newStock < 0) throw new Error("Le stock ne peut pas être négatif");

        const typeMvt = delta > 0 ? "ENTREE" : "SORTIE";
        await tx.mouvementStock.create({
          data: {
            produitId:  id,
            type:       typeMvt,
            quantite:   Math.abs(delta),
            motif:      motifAjustement ?? `Ajustement RPV par ${session.user.name ?? "RPV"}`,
            reference:  `RPV-ADJ-${randomUUID()}`,
          },
        });
        updated = await tx.produit.update({
          where: { id },
          data:  { stock: newStock },
        });
      }
      return updated;
    });

    return NextResponse.json({
      success: true,
      message: "Produit mis à jour",
      data: { ...produit, prixUnitaire: Number(produit.prixUnitaire) },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur serveur";
    if (msg === "Le stock ne peut pas être négatif")
      return NextResponse.json({ message: msg }, { status: 400 });
    console.error("PUT /api/rpv/produits/[id] error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}

/** DELETE /api/rpv/produits/[id] — Supprime un produit sans ventes liées */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const id = Number(params.id);
    const produit = await prisma.produit.findUnique({
      where:  { id },
      include: { ventesCreditAlim: { take: 1 }, livraisonsLignes: { take: 1 } },
    });
    if (!produit) return NextResponse.json({ message: "Produit introuvable" }, { status: 404 });
    if (produit.ventesCreditAlim.length > 0)
      return NextResponse.json({ message: "Impossible de supprimer : des ventes sont liées à ce produit" }, { status: 409 });
    if (produit.livraisonsLignes.length > 0)
      return NextResponse.json({ message: "Impossible de supprimer : ce produit est présent dans des livraisons" }, { status: 409 });

    await prisma.$transaction([
      prisma.mouvementStock.deleteMany({ where: { produitId: id } }),
      prisma.produit.delete({ where: { id } }),
    ]);

    return NextResponse.json({ success: true, message: "Produit supprimé" });
  } catch (error) {
    console.error("DELETE /api/rpv/produits/[id] error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
