import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { genererDotationsDuMois } from "@/lib/comptabilite/immobilisations";

/**
 * POST /api/comptable/immobilisations/dotations
 * Body: { annee?: number, mois?: number } — défaut : mois courant.
 * Génère en une fois les dotations d'amortissement de toutes les immobilisations
 * EN_SERVICE pour la période (CDC §22 — automatisation), en ignorant celles déjà
 * comptabilisées.
 */
export async function POST(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const now = new Date();
    const annee = Number(body?.annee) || now.getFullYear();
    const mois = Number(body?.mois) || now.getMonth() + 1;

    const userId = Number(session.user.id);
    const result = await prisma.$transaction((tx) => genererDotationsDuMois(tx, annee, mois, userId));

    return NextResponse.json({
      success: true,
      message: `${result.created} dotation(s) générée(s) sur ${result.total} immobilisation(s) en service.`,
      data: result,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
