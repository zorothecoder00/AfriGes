import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { getComptableSession } from "@/lib/authComptable";

/**
 * GET /api/collectes?agentId=&limit=
 * Historique des fiches journalières de collecte (une par CollecteJournaliere, hors annulées) :
 * l'agent ne voit que les siennes ; comptable/admin voient tout (filtre agentId facultatif).
 */
export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 30));
    const voitTout = !!(await getComptableSession());
    const agentId = voitTout
      ? (searchParams.get("agentId") ? Number(searchParams.get("agentId")) : undefined)
      : parseInt(session.user.id);

    const collectes = await prisma.collecteJournaliere.findMany({
      where: { statut: { not: "ANNULEE" }, ...(agentId ? { agentId } : {}) },
      orderBy: { dateCollecte: "desc" },
      take: limit,
      select: {
        id: true, reference: true, dateCollecte: true, statut: true, montantPrevu: true, montantCollecte: true,
        agent: { select: { nom: true, prenom: true } },
        _count: { select: { lignes: { where: { montantCollecte: { gt: 0 } } } } },
      },
    });
    return NextResponse.json({ data: collectes });
  } catch (error) {
    console.error("GET /collectes:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
