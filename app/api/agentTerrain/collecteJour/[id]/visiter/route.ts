import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/agentTerrain/collecteJour/[id]/visiter
 * Marque un client comme visité dans la session du jour, sans encaissement
 * (rien à collecter ou collecte refusée). Body: { clientId, notes?, latitude?, longitude? }
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const collecteId = parseInt(id);
    const agentId = parseInt(session.user.id);

    const body = await req.json();
    const { clientId, notes, latitude, longitude } = body as {
      clientId?: number; notes?: string; latitude?: number; longitude?: number;
    };

    if (!clientId) return NextResponse.json({ error: "clientId requis" }, { status: 400 });

    const collecte = await prisma.collecteJournaliere.findUnique({ where: { id: collecteId } });
    if (!collecte) return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
    if (collecte.agentId !== agentId) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    if (collecte.statut !== "EN_COURS") return NextResponse.json({ error: "Session non active" }, { status: 400 });

    const client = await prisma.client.findUnique({
      where: { id: parseInt(String(clientId)) },
      select: { agentTerrainId: true },
    });
    if (!client || client.agentTerrainId !== agentId) {
      return NextResponse.json({ error: "Client non assigné à cet agent" }, { status: 403 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const visite = await tx.visiteClient.create({
        data: {
          agentId,
          clientId: parseInt(String(clientId)),
          statut: "REALISEE",
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          notes: notes ?? null,
        },
      });

      await tx.ligneCollecte.create({
        data: {
          collecteId,
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

      await auditLog(tx, agentId, "VISITE_CLIENT_SESSION", "VisiteClient", visite.id);

      return visite;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/agentTerrain/collecteJour/[id]/visiter", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
