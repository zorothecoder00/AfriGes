import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { genererBilan, genererCompteResultat, genererTableauFlux, genererNotesAnnexes } from "@/lib/comptabilite/etatsFinanciers";

/**
 * GET /api/comptable/etats-financiers-reels?annee=2026
 * Bilan, compte de résultat, tableau de flux et notes annexes — calculés
 * exclusivement depuis les écritures comptables validées (CDC §36-39).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const currentYear = new Date().getFullYear();
    const annee = Math.min(currentYear + 1, Math.max(2020, Number(req.nextUrl.searchParams.get("annee") ?? currentYear)));
    const dateDebut = new Date(annee, 0, 1);
    const dateFin = new Date(annee, 11, 31, 23, 59, 59, 999);

    const [bilan, compteResultat, tableauFlux, notesAnnexes] = await Promise.all([
      genererBilan(prisma, dateFin),
      genererCompteResultat(prisma, dateDebut, dateFin),
      genererTableauFlux(prisma, dateDebut, dateFin),
      genererNotesAnnexes(prisma, dateDebut, dateFin),
    ]);

    return NextResponse.json({ data: { annee, bilan, compteResultat, tableauFlux, notesAnnexes } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
