import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { agentDepuisJetonScan, trouverOuCreerSessionDuJour } from "@/lib/collecteSession";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ token: string }> };

/**
 * POST /api/agent-scan/[token]/visiter  (PUBLIC — jeton opaque en guise d'authentification)
 * Marque un client comme visité depuis la page scannée, sans encaissement.
 * Body: { clientId, notes?, latitude?, longitude? }
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { token } = await params;
    const agent = await agentDepuisJetonScan(token);
    if (!agent) return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 404 });

    const body = await req.json();
    const { clientId, notes, latitude, longitude } = body as {
      clientId?: number; notes?: string; latitude?: number; longitude?: number;
    };
    if (!clientId) return NextResponse.json({ error: "clientId requis" }, { status: 400 });

    const client = await prisma.client.findUnique({
      where: { id: parseInt(String(clientId)) },
      select: { agentTerrainId: true },
    });
    if (!client || client.agentTerrainId !== agent.id) {
      return NextResponse.json({ error: "Client non assigné à cet agent" }, { status: 403 });
    }

    const collecte = await trouverOuCreerSessionDuJour(agent.id);

    const result = await prisma.$transaction(async (tx) => {
      const visite = await tx.visiteClient.create({
        data: {
          agentId: agent.id,
          clientId: parseInt(String(clientId)),
          statut: "REALISEE",
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          notes: notes ?? null,
        },
      });

      await tx.ligneCollecte.create({
        data: {
          collecteId: collecte.id,
          clientId: parseInt(String(clientId)),
          type: "VISITE",
          visiteId: visite.id,
          montantAttendu: 0,
          montantCollecte: 0,
          statut: "COLLECTE",
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          notes: notes ?? null,
        },
      });

      await auditLog(tx, agent.id, "VISITE_CLIENT_SCAN", "VisiteClient", visite.id);

      return visite;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/agent-scan/[token]/visiter", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
