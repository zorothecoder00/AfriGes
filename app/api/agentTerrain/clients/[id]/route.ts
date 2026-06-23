import { NextResponse } from "next/server";
import { chargerClientDetail } from "@/lib/clientFiche";
import { gardeClientAgentTerrain } from "@/lib/clientFicheGuards";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/agentTerrain/clients/[id] — fiche client (lecture, clients affectés). */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const clientId = Number(id);
    if (isNaN(clientId)) return NextResponse.json({ message: "ID invalide" }, { status: 400 });

    const garde = await gardeClientAgentTerrain(clientId);
    if (garde) return garde;

    const client = await chargerClientDetail(clientId);
    if (!client) return NextResponse.json({ message: "Client introuvable" }, { status: 404 });
    return NextResponse.json({ data: client });
  } catch (error) {
    console.error("GET /api/agentTerrain/clients/[id]", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
