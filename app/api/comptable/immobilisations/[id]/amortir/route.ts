import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { genererDotationPeriode } from "@/lib/comptabilite/immobilisations";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/comptable/immobilisations/[id]/amortir
 * Body: { annee?: number, mois?: number } — défaut : mois courant.
 * Génère la dotation d'amortissement de cette immobilisation pour la période
 * (idempotent — CDC §22 "le système calcule").
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const immobilisationId = Number(id);
    if (isNaN(immobilisationId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const now = new Date();
    const annee = Number(body?.annee) || now.getFullYear();
    const mois = Number(body?.mois) || now.getMonth() + 1;

    const userId = Number(session.user.id);
    const result = await prisma.$transaction((tx) => genererDotationPeriode(tx, immobilisationId, annee, mois, userId));

    if (!result.created) {
      return NextResponse.json({
        success: false,
        message: "Aucune dotation générée (déjà comptabilisée, immobilisation hors service, entièrement amortie, ou avant mise en service)",
      });
    }
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
