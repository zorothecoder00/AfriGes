import { NextResponse } from "next/server";
import { chargerClientCredits } from "@/lib/clientFiche";
import { gardeClientRVC } from "@/lib/clientFicheGuards";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/rvc/clients/[id]/credits — crédits du client + stats (scoped PDV). */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const clientId = Number(id);
    if (isNaN(clientId)) return NextResponse.json({ message: "ID invalide" }, { status: 400 });

    const garde = await gardeClientRVC(clientId);
    if (garde) return garde;

    const { credits, stats } = await chargerClientCredits(clientId);
    return NextResponse.json({ data: credits, stats });
  } catch (error) {
    console.error("GET /api/rvc/clients/[id]/credits", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
