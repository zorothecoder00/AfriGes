import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { genererGrandLivreClient } from "@/lib/comptabilite/clientAuxiliaire";
import { gardeClientAgentTerrain } from "@/lib/clientFicheGuards";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/agentTerrain/clients/[id]/releve?dateDebut=&dateFin=
 * Relevé de compte client (CDC digitalisation §5.4), scoped à l'agent affecté
 * — même moteur que le relevé comptable (lib/comptabilite/clientAuxiliaire.ts).
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const clientId = Number(id);
    if (isNaN(clientId)) return NextResponse.json({ message: "ID invalide" }, { status: 400 });

    const garde = await gardeClientAgentTerrain(clientId);
    if (garde) return garde;

    const { searchParams } = new URL(req.url);
    const dateDebut = searchParams.get("dateDebut") ? new Date(searchParams.get("dateDebut")!) : null;
    const dateFin = searchParams.get("dateFin") ? new Date(`${searchParams.get("dateFin")}T23:59:59`) : new Date();

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true, nom: true, prenom: true, codeClient: true, telephone: true, adresse: true,
        limiteCredit: true, soldeActuel: true, delaiPaiementJours: true,
      },
    });
    if (!client) return NextResponse.json({ message: "Client introuvable" }, { status: 404 });

    const grandLivre = await genererGrandLivreClient(prisma, clientId, { dateDebut, dateFin });

    return NextResponse.json({
      data: { client, periode: { debut: dateDebut, fin: dateFin }, ...grandLivre },
    });
  } catch (e) {
    console.error("GET /agentTerrain/clients/[id]/releve:", e);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
