import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

type TypeJournal = "VENTE" | "NOUVEAU_CLIENT";

/**
 * POST /api/agentTerrain/collecteJour/[id]/journaliser
 * Journalise dans la session une activité déjà effectuée via une autre route
 * (vente via /api/agentTerrain/ventes, ou création d'un client). N'applique
 * aucun effet financier lui-même — uniquement la traçabilité de session
 * (LigneCollecte + progression montantCollecte). Le paiement par compte
 * courant a sa propre route atomique dédiée : /paiement-cc.
 * Body: { type: "VENTE"|"NOUVEAU_CLIENT", clientId, creditId?, venteDirecteId?, clientNouveauId?, notes? }
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const collecteId = parseInt(id);
    const agentId = parseInt(session.user.id);

    const body = await req.json();
    const { type, clientId, venteDirecteId, clientNouveauId, notes } = body as {
      type?: TypeJournal; clientId?: number;
      venteDirecteId?: number; clientNouveauId?: number; notes?: string;
    };

    if (!type || !["VENTE", "NOUVEAU_CLIENT"].includes(type)) {
      return NextResponse.json({ error: "type requis : VENTE ou NOUVEAU_CLIENT" }, { status: 400 });
    }
    const clientIdEffectif = clientId ?? (type === "NOUVEAU_CLIENT" ? clientNouveauId : undefined);
    if (!clientIdEffectif) return NextResponse.json({ error: "clientId requis" }, { status: 400 });

    const collecte = await prisma.collecteJournaliere.findUnique({ where: { id: collecteId } });
    if (!collecte) return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
    if (collecte.agentId !== agentId) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    if (collecte.statut !== "EN_COURS") return NextResponse.json({ error: "Session non active" }, { status: 400 });

    const client = await prisma.client.findUnique({
      where: { id: parseInt(String(clientIdEffectif)) },
      select: { agentTerrainId: true },
    });
    if (!client || client.agentTerrainId !== agentId) {
      return NextResponse.json({ error: "Client non assigné à cet agent" }, { status: 403 });
    }

    if (type === "VENTE" && !venteDirecteId) {
      return NextResponse.json({ error: "venteDirecteId requis pour type VENTE" }, { status: 400 });
    }

    // Le montant journalisé n'est jamais celui envoyé par le client : on le
    // revérifie à partir de l'enregistrement réel, pour qu'un appel direct à
    // cette route ne puisse pas gonfler artificiellement le résumé de session
    // sans mouvement réel correspondant.
    let montantNum = 0;
    if (type === "VENTE") {
      const vente = await prisma.venteDirecte.findUnique({
        where: { id: parseInt(String(venteDirecteId)) },
        select: { clientId: true, vendeurId: true, montantTotal: true },
      });
      if (!vente || vente.clientId !== parseInt(String(clientIdEffectif)) || vente.vendeurId !== agentId) {
        return NextResponse.json({ error: "Vente introuvable ou non rattachée à ce client/agent" }, { status: 403 });
      }
      montantNum = Number(vente.montantTotal);
    }

    const result = await prisma.$transaction(async (tx) => {
      const ligne = await tx.ligneCollecte.create({
        data: {
          collecteId,
          clientId: parseInt(String(clientIdEffectif)),
          type,
          venteDirecteId: type === "VENTE" ? parseInt(String(venteDirecteId)) : null,
          clientNouveauId: type === "NOUVEAU_CLIENT" ? parseInt(String(clientIdEffectif)) : null,
          montantAttendu: montantNum,
          montantCollecte: montantNum,
          statut: "COLLECTE",
          notes: notes ?? null,
        },
      });

      if (montantNum > 0) {
        await tx.collecteJournaliere.update({
          where: { id: collecteId },
          data: { montantCollecte: { increment: montantNum } },
        });
      }

      await auditLog(tx, agentId, `SESSION_JOURNAL_${type}`, "LigneCollecte", ligne.id);

      return ligne;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/agentTerrain/collecteJour/[id]/journaliser", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
