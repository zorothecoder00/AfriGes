import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/magasinier/stock/[id]
 * Detail d'un produit avec ses mouvements
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const session = await getMagasinierSession();
    if (!session) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { id } = await params;
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
    console.error("GET /magasinier/stock/[id] error:", error);
    return NextResponse.json({ error: "Erreur lors de la recuperation" }, { status: 500 });
  }
}
