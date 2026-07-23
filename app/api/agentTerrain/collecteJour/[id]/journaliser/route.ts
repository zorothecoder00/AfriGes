import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

type TypeJournal = "CC" | "VENTE" | "NOUVEAU_CLIENT";

/**
 * POST /api/agentTerrain/collecteJour/[id]/journaliser
 * Journalise dans la session une activité déjà effectuée via une autre route
 * (paiement CC via /api/comptes-courants/[id]/paiements, vente via
 * /api/agentTerrain/ventes, ou création d'un client). N'applique aucun effet
 * financier lui-même — uniquement la traçabilité de session (LigneCollecte +
 * progression montantCollecte).
 * Body: { type: "CC"|"VENTE"|"NOUVEAU_CLIENT", clientId, montant?, creditId?, venteDirecteId?, clientNouveauId?, notes? }
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const collecteId = parseInt(id);
    const agentId = parseInt(session.user.id);

    const body = await req.json();
    const { type, clientId, montant, creditId, venteDirecteId, clientNouveauId, notes } = body as {
      type?: TypeJournal; clientId?: number; montant?: number;
      creditId?: number; venteDirecteId?: number; clientNouveauId?: number; notes?: string;
    };

    if (!type || !["CC", "VENTE", "NOUVEAU_CLIENT"].includes(type)) {
      return NextResponse.json({ error: "type requis : CC, VENTE ou NOUVEAU_CLIENT" }, { status: 400 });
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

    const montantNum = type === "NOUVEAU_CLIENT" ? 0 : Math.max(0, Number(montant) || 0);
    if (type !== "NOUVEAU_CLIENT" && montantNum <= 0) {
      return NextResponse.json({ error: "montant requis et > 0" }, { status: 400 });
    }
    if (type === "CC" && !creditId) {
      return NextResponse.json({ error: "creditId requis pour type CC" }, { status: 400 });
    }
    if (type === "VENTE" && !venteDirecteId) {
      return NextResponse.json({ error: "venteDirecteId requis pour type VENTE" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const ligne = await tx.ligneCollecte.create({
        data: {
          collecteId,
          clientId: parseInt(String(clientIdEffectif)),
          type,
          creditId: type === "CC" ? parseInt(String(creditId)) : null,
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
