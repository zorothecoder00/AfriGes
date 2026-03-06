import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/agentTerrain/ventes/[id]
 * L'agent terrain annule sa propre demande de vente (BROUILLON → ANNULEE uniquement).
 * Body: { action: "ANNULER" }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const venteId = Number(id);
    if (isNaN(venteId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    if (body.action !== "ANNULER") {
      return NextResponse.json({ error: "action invalide (seul ANNULER est permis pour l'agent)" }, { status: 400 });
    }

    const vente = await prisma.venteDirecte.findUnique({ where: { id: venteId } });
    if (!vente) return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });
    if (vente.vendeurId !== parseInt(session.user.id)) {
      return NextResponse.json({ error: "Vous ne pouvez annuler que vos propres demandes" }, { status: 403 });
    }
    if (vente.statut !== "BROUILLON") {
      return NextResponse.json({ error: `Impossible d'annuler : statut actuel "${vente.statut}"` }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.venteDirecte.update({
        where: { id: venteId },
        data:  { statut: "ANNULEE" },
      });
      await auditLog(tx, parseInt(session.user.id), "VENTE_TERRAIN_ANNULEE", "VenteDirecte", venteId);
      return result;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /agentTerrain/ventes/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
