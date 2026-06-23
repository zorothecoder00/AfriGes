import { NextResponse } from "next/server";
import { chargerClientHistorique } from "@/lib/clientFiche";
import { gardeClientRVC } from "@/lib/clientFicheGuards";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/rvc/clients/[id]/historique — timeline du client (scoped PDV). */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const clientId = Number(id);
    if (isNaN(clientId)) return NextResponse.json({ message: "ID invalide" }, { status: 400 });

    const garde = await gardeClientRVC(clientId);
    if (garde) return garde;

    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, Number(searchParams.get("page")  ?? "1"));
    const limit = Math.min(50, Number(searchParams.get("limit") ?? "30"));

    const result = await chargerClientHistorique(clientId, page, limit);
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/rvc/clients/[id]/historique", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
