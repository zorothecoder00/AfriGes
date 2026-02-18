import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { randomUUID } from "crypto";

/**
 * POST /api/agentTerrain/ventes
 * Vendre un produit via crédit alimentaire
 */
export async function POST(req: Request) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const body = await req.json();
    const { creditAlimentaireId, produitId, quantite } = body;

    if (!creditAlimentaireId || !produitId || !quantite) {
      return NextResponse.json(
        { error: "Champs obligatoires manquants (creditAlimentaireId, produitId, quantite)" },
        { status: 400 }
      );
    }

    if (Number(quantite) <= 0) {
      return NextResponse.json({ error: "La quantite doit etre superieure a 0" }, { status: 400 });
    }

    const creditAlim = await prisma.creditAlimentaire.findUnique({
      where: { id: Number(creditAlimentaireId) },
      include: { client: { select: { id: true, nom: true, prenom: true } } },
    });

    if (!creditAlim) {
      return NextResponse.json({ error: "Credit alimentaire introuvable" }, { status: 404 });
    }

    if (creditAlim.statut !== "ACTIF") {
      return NextResponse.json({ error: "Ce credit alimentaire n'est plus actif" }, { status: 400 });
    }

    const produit = await prisma.produit.findUnique({ where: { id: Number(produitId) } });
    if (!produit) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }

    if (produit.stock < Number(quantite)) {
      return NextResponse.json({ error: "Stock insuffisant" }, { status: 400 });
    }

    const montantTotal = Number(produit.prixUnitaire) * Number(quantite);

    if (montantTotal > Number(creditAlim.montantRestant)) {
      return NextResponse.json({ error: "Solde du credit alimentaire insuffisant" }, { status: 400 });
    }

    const vente = await prisma.$transaction(async (tx) => {
      const created = await tx.venteCreditAlimentaire.create({
        data: {
          creditAlimentaireId: Number(creditAlimentaireId),
          produitId: Number(produitId),
          quantite: Number(quantite),
          prixUnitaire: produit.prixUnitaire,
        },
        include: {
          produit: { select: { id: true, nom: true, prixUnitaire: true } },
          creditAlimentaire: {
            select: {
              id: true,
              client: { select: { id: true, nom: true, prenom: true } },
            },
          },
        },
      });

      const newUtilise = Number(creditAlim.montantUtilise) + montantTotal;
      const newRestant = Number(creditAlim.plafond) - newUtilise;

      await tx.creditAlimentaire.update({
        where: { id: Number(creditAlimentaireId) },
        data: {
          montantUtilise: new Prisma.Decimal(newUtilise),
          montantRestant: new Prisma.Decimal(Math.max(0, newRestant)),
          statut: newRestant <= 0 ? "EPUISE" : "ACTIF",
        },
      });

      await tx.produit.update({
        where: { id: Number(produitId) },
        data: { stock: { decrement: Number(quantite) } },
      });

      await tx.mouvementStock.create({
        data: {
          produitId: Number(produitId),
          type: "SORTIE",
          quantite: Number(quantite),
          motif: `Vente terrain credit alim #${created.id} par agent ${session.user.prenom} ${session.user.nom}`,
          reference: `VENTE-TERRAIN-${randomUUID()}`,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: parseInt(session.user.id),
          action: "VENTE_CREDIT_ALIMENTAIRE_TERRAIN",
          entite: "VenteCreditAlimentaire",
          entiteId: created.id,
        },
      });

      return created;
    });

    return NextResponse.json({ data: vente }, { status: 201 });
  } catch (error) {
    console.error("POST /agentTerrain/ventes error:", error);
    return NextResponse.json({ error: "Erreur lors de la vente" }, { status: 500 });
  }
}
