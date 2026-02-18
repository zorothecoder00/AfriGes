import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";

/**
 * GET /api/agentTerrain/creditsAlimentaires
 * Liste crédits alimentaires avec stats
 */
export async function GET(req: Request) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip = (page - 1) * limit;
    const search = searchParams.get("search") || "";
    const statutParam = searchParams.get("statut");

    const where: Prisma.CreditAlimentaireWhereInput = {
      ...(statutParam && { statut: statutParam as "ACTIF" | "EPUISE" | "EXPIRE" }),
      ...(search && {
        client: {
          OR: [
            { nom: { contains: search, mode: "insensitive" } },
            { prenom: { contains: search, mode: "insensitive" } },
            { telephone: { contains: search, mode: "insensitive" } },
          ],
        },
      }),
    };

    const [credits, total] = await Promise.all([
      prisma.creditAlimentaire.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          client: { select: { id: true, nom: true, prenom: true, telephone: true } },
          ventes: {
            orderBy: { createdAt: "desc" },
            take: 5,
            include: {
              produit: { select: { id: true, nom: true, prixUnitaire: true } },
            },
          },
        },
      }),
      prisma.creditAlimentaire.count({ where }),
    ]);

    const [totalActifs, totalEpuises, totalExpires] = await Promise.all([
      prisma.creditAlimentaire.count({ where: { statut: "ACTIF" } }),
      prisma.creditAlimentaire.count({ where: { statut: "EPUISE" } }),
      prisma.creditAlimentaire.count({ where: { statut: "EXPIRE" } }),
    ]);

    return NextResponse.json({
      data: credits,
      stats: { totalActifs, totalEpuises, totalExpires },
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /agentTerrain/creditsAlimentaires error:", error);
    return NextResponse.json({ error: "Erreur lors du chargement" }, { status: 500 });
  }
}
