import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { auditLog, notifyAdmins } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

function genRefCarnet(count: number): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `CAR-${ymd}-${String(count + 1).padStart(4, "0")}`;
}

/**
 * POST /api/agentTerrain/collecteJour/[id]/carnet
 * Enregistre une vente de carnet dans la session de collecte du jour.
 * Body: { montant?, clientId? }
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const collecteId = parseInt(id);
    const agentId = parseInt(session.user.id);
    const agentNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();

    const body = await req.json().catch(() => ({}));
    const { montant, clientId } = body as { montant?: number; clientId?: number };

    const collecte = await prisma.collecteJournaliere.findUnique({ where: { id: collecteId } });
    if (!collecte) return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
    if (collecte.agentId !== agentId) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    if (collecte.statut !== "EN_COURS") return NextResponse.json({ error: "Session non active" }, { status: 400 });

    const montantNum = montant != null && Number(montant) > 0 ? Number(montant) : 300;

    if (clientId) {
      const client = await prisma.client.findUnique({ where: { id: parseInt(String(clientId)) }, select: { agentTerrainId: true } });
      if (!client || client.agentTerrainId !== agentId) {
        return NextResponse.json({ error: "Client non assigné à cet agent" }, { status: 403 });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const count = await tx.venteCarnet.count();
      const venteCarnet = await tx.venteCarnet.create({
        data: {
          reference: genRefCarnet(count),
          montant: montantNum,
          agentId,
          pointDeVenteId: collecte.pointDeVenteId,
          clientId: clientId ? parseInt(String(clientId)) : null,
          enregistreParId: agentId,
          notes: `Session collecte ${collecte.reference} — ${agentNom}`,
        },
      });

      await tx.collecteJournaliere.update({
        where: { id: collecteId },
        data: { montantCollecte: { increment: montantNum } },
      });

      // Ligne d'activité de la session (uniquement si rattachée à un client identifié)
      if (clientId) {
        await tx.ligneCollecte.create({
          data: {
            collecteId,
            clientId: parseInt(String(clientId)),
            type: "CARNET",
            venteCarnetId: venteCarnet.id,
            montantAttendu: montantNum,
            montantCollecte: montantNum,
            statut: "COLLECTE",
            modePaiement: "ESPECES",
          },
        });
      }

      await auditLog(tx, agentId, "VENTE_CARNET", "VenteCarnet", venteCarnet.id);

      await notifyAdmins(tx, {
        titre: "Vente de carnet",
        message: `${agentNom} a vendu un carnet (${montantNum.toLocaleString("fr-FR")} FCFA, session ${collecte.reference}).`,
        priorite: "NORMAL",
        actionUrl: "/dashboard/admin/popc",
      });

      return venteCarnet;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/agentTerrain/collecteJour/[id]/carnet", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
