import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { ecritureSortieImmobilisation } from "@/lib/comptabilite/immobilisations";

type Ctx = { params: Promise<{ id: string }> };

const MESSAGES: Record<string, [string, number]> = {
  IMMOBILISATION_INTROUVABLE: ["Immobilisation introuvable", 404],
  DEJA_CEDEE: ["Cette immobilisation a déjà été cédée", 422],
};

/**
 * POST /api/comptable/immobilisations/[id]/ceder
 * Body: { prixCession?: number } — sortie du patrimoine (CDC §22 : cession/sortie).
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const immobilisationId = Number(id);
    if (isNaN(immobilisationId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const prixCession = body?.prixCession != null ? Number(body.prixCession) : undefined;
    const userId = Number(session.user.id);

    await prisma.$transaction((tx) => ecritureSortieImmobilisation(tx, immobilisationId, userId, prixCession));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/comptable/immobilisations/[id]/ceder", error);
    if (error instanceof Error && MESSAGES[error.message]) {
      const [message, status] = MESSAGES[error.message];
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
