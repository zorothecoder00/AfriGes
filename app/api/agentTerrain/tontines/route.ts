import { NextResponse } from "next/server";
import { StatutTontine } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";

/**
 * GET /api/agentTerrain/tontines
 * Liste tontines actives avec cycles en cours et contributions
 */
export async function GET(_req: Request) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const tontines = await prisma.tontine.findMany({
      where: { statut: { in: [StatutTontine.ACTIVE] } },
      include: {
        membres: {
          include: {
            client: { select: { id: true, nom: true, prenom: true, telephone: true } },
          },
          orderBy: { ordreTirage: "asc" },
        },
        cycles: {
          include: {
            beneficiaire: {
              include: {
                client: { select: { id: true, nom: true, prenom: true, telephone: true } },
              },
            },
            contributions: {
              include: {
                membre: {
                  include: {
                    client: { select: { id: true, nom: true, prenom: true, telephone: true } },
                  },
                },
              },
              orderBy: { membre: { ordreTirage: "asc" } },
            },
          },
          orderBy: { numeroCycle: "desc" },
        },
        _count: { select: { membres: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: tontines });
  } catch (error) {
    console.error("GET /agentTerrain/tontines error:", error);
    return NextResponse.json({ error: "Erreur lors du chargement des tontines" }, { status: 500 });
  }
}
