import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getReclamationSession } from "@/lib/authReclamation";

/**
 * GET /api/admin/reclamations/produits-recherche?q=
 * Recherche produit (nom/code) pour les formulaires de réclamation, retour
 * marchandise et remplacement — pas de scope PDV (catalogue global).
 */
export async function GET(req: Request) {
  try {
    const session = await getReclamationSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (q.length < 2) return NextResponse.json({ data: [] });

    const where: Prisma.ProduitWhereInput = {
      OR: [
        { nom: { contains: q, mode: "insensitive" } },
        { codeProduit: { contains: q, mode: "insensitive" } },
      ],
    };

    const produits = await prisma.produit.findMany({
      where,
      select: { id: true, nom: true, codeProduit: true },
      take: 10,
    });
    return NextResponse.json({ data: produits });
  } catch (error) {
    console.error("GET /admin/reclamations/produits-recherche:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
