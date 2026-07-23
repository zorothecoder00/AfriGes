import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { agentDepuisJetonScan, trouverOuCreerSessionDuJour } from "@/lib/collecteSession";
import { auditLog, notifyAdmins } from "@/lib/notifications";

type Ctx = { params: Promise<{ token: string }> };

function genRefCarnet(count: number): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `CAR-${ymd}-${String(count + 1).padStart(4, "0")}`;
}

/**
 * POST /api/agent-scan/[token]/carnet  (PUBLIC — jeton opaque en guise d'authentification)
 * Enregistre une vente de carnet depuis la page scannée, sans connexion.
 * Body: { montant?, clientId? }
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { token } = await params;
    const agent = await agentDepuisJetonScan(token);
    if (!agent) return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const { montant, clientId } = body as { montant?: number; clientId?: number };
    const montantNum = montant != null && Number(montant) > 0 ? Number(montant) : 300;

    if (clientId) {
      const client = await prisma.client.findUnique({ where: { id: parseInt(String(clientId)) }, select: { agentTerrainId: true } });
      if (!client || client.agentTerrainId !== agent.id) {
        return NextResponse.json({ error: "Client non assigné à cet agent" }, { status: 403 });
      }
    }

    const agentNom = `${agent.prenom} ${agent.nom}`;
    const collecte = await trouverOuCreerSessionDuJour(agent.id);

    const result = await prisma.$transaction(async (tx) => {
      const count = await tx.venteCarnet.count();
      const venteCarnet = await tx.venteCarnet.create({
        data: {
          reference: genRefCarnet(count),
          montant: montantNum,
          agentId: agent.id,
          pointDeVenteId: collecte.pointDeVenteId,
          clientId: clientId ? parseInt(String(clientId)) : null,
          enregistreParId: agent.id,
          notes: `Scan QR — session ${collecte.reference} — ${agentNom}`,
        },
      });

      await tx.collecteJournaliere.update({
        where: { id: collecte.id },
        data: { montantCollecte: { increment: montantNum } },
      });

      if (clientId) {
        await tx.ligneCollecte.create({
          data: {
            collecteId: collecte.id,
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

      await auditLog(tx, agent.id, "VENTE_CARNET_SCAN", "VenteCarnet", venteCarnet.id);

      await notifyAdmins(tx, {
        titre: "Vente de carnet",
        message: `${agentNom} a vendu un carnet (${montantNum.toLocaleString("fr-FR")} FCFA, via QR).`,
        priorite: "NORMAL",
        actionUrl: "/dashboard/admin/popc",
      });

      return venteCarnet;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/agent-scan/[token]/carnet", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
