import { NextResponse } from "next/server";
import { chargerClientCredits } from "@/lib/clientFiche";
import { gardeClientAgentTerrain } from "@/lib/clientFicheGuards";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/agentTerrain/clients/[id]/credits — crédits du client + stats. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const clientId = Number(id);
    if (isNaN(clientId)) return NextResponse.json({ message: "ID invalide" }, { status: 400 });

    const garde = await gardeClientAgentTerrain(clientId);
    if (garde) return garde;

    const { credits, stats } = await chargerClientCredits(clientId);
    return NextResponse.json({ data: credits, stats });
  } catch (error) {
    console.error("GET /api/agentTerrain/clients/[id]/credits", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
