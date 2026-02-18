import { NextResponse } from "next/server";
import { Prisma, StatutCotisation, PeriodeCotisation } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";

/**
 * GET /api/agentTerrain/cotisations
 * Liste cotisations avec pagination, recherche et stats
 */
export async function GET(req: Request) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 10)));
    const skip = (page - 1) * limit;
    const search = searchParams.get("search") || "";
    const statutParam = searchParams.get("statut");

    const statut =
      statutParam && Object.values(StatutCotisation).includes(statutParam as StatutCotisation)
        ? (statutParam as StatutCotisation)
        : undefined;

    const where: Prisma.CotisationWhereInput = {
      ...(statut && { statut }),
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

    const [cotisations, total] = await Promise.all([
      prisma.cotisation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          client: { select: { id: true, nom: true, prenom: true, telephone: true } },
        },
      }),
      prisma.cotisation.count({ where }),
    ]);

    const [totalPayees, totalEnAttente, totalExpirees] = await Promise.all([
      prisma.cotisation.count({ where: { statut: StatutCotisation.PAYEE } }),
      prisma.cotisation.count({ where: { statut: StatutCotisation.EN_ATTENTE } }),
      prisma.cotisation.count({ where: { statut: StatutCotisation.EXPIREE } }),
    ]);

    return NextResponse.json({
      data: cotisations,
      stats: { totalPayees, totalEnAttente, totalExpirees },
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /agentTerrain/cotisations error:", error);
    return NextResponse.json({ error: "Erreur lors du chargement des cotisations" }, { status: 500 });
  }
}
