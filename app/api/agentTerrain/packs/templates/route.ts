import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";

/**
 * GET /api/agentTerrain/packs/templates
 * Retourne les packs actifs pour alimenter le modal "Nouvelle souscription".
 */
export async function GET() {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const packs = await prisma.pack.findMany({
      where: { actif: true },
      select: {
        id: true,
        nom: true,
        type: true,
        dureeJours: true,
        frequenceVersement: true,
        acomptePercent: true,
        montantVersement: true,
        description: true,
      },
      orderBy: { nom: "asc" },
    });

    return NextResponse.json({ packs });
  } catch (error) {
    console.error("GET /api/agentTerrain/packs/templates", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
