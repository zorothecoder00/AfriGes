import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";

/**
 * GET /api/agentTerrain/produits
 * Recherche de produits du catalogue pour l'agent terrain (création de demande de crédit).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const limit  = Math.min(20, Math.max(1, Number(searchParams.get("limit") || 10)));

    const produits = await prisma.produit.findMany({
      where: {
        actif: true,
        ...(search && {
          OR: [
            { nom:       { contains: search, mode: "insensitive" } },
            { reference: { contains: search, mode: "insensitive" } },
          ],
        }),
      },
      select: {
        id:        true,
        nom:       true,
        reference: true,
        prixUnitaire: true,
        unite:     true,
      },
      orderBy: { nom: "asc" },
      take: limit,
    });

    return NextResponse.json({ data: produits });
  } catch (error) {
    console.error("GET /api/agentTerrain/produits", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
