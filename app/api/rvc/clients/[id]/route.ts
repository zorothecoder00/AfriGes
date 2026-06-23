import { NextResponse } from "next/server";
import { chargerClientDetail } from "@/lib/clientFiche";
import { gardeClientRVC } from "@/lib/clientFicheGuards";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/rvc/clients/[id] — fiche client (lecture, scoped PDV). */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const clientId = Number(id);
    if (isNaN(clientId)) return NextResponse.json({ message: "ID invalide" }, { status: 400 });

    const garde = await gardeClientRVC(clientId);
    if (garde) return garde;

    const client = await chargerClientDetail(clientId);
    if (!client) return NextResponse.json({ message: "Client introuvable" }, { status: 404 });
    return NextResponse.json({ data: client });
  } catch (error) {
    console.error("GET /api/rvc/clients/[id]", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
