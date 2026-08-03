import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { confirmerRapprochement } from "@/lib/comptabilite/rapprochementImport";

const MESSAGES: Record<string, [string, number]> = {
  LIGNE_RELEVE_INTROUVABLE: ["Ligne de relevé introuvable", 404],
  DEJA_RAPPROCHEE: ["Cette ligne est déjà rapprochée", 422],
};

/**
 * POST /api/comptable/rapprochement/confirmer
 * Body: { ligneReleveId, ligneEcritureId }
 * Confirme un rapprochement ligne à ligne (CDC §19 — "le comptable confirme").
 */
export async function POST(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { ligneReleveId, ligneEcritureId } = body as { ligneReleveId?: number; ligneEcritureId?: number };
    if (!ligneReleveId || !ligneEcritureId) {
      return NextResponse.json({ error: "ligneReleveId et ligneEcritureId sont requis" }, { status: 400 });
    }

    await prisma.$transaction((tx) => confirmerRapprochement(tx, Number(ligneReleveId), Number(ligneEcritureId)));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/comptable/rapprochement/confirmer", error);
    if (error instanceof Error && MESSAGES[error.message]) {
      const [message, status] = MESSAGES[error.message];
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
