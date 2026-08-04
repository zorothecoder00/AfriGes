import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableLectureSession } from "@/lib/authComptable";
import { genererBilan, genererCompteResultatDetaille, genererTableauFluxDetaille, genererNotesAnnexes, genererResultatParPointDeVente } from "@/lib/comptabilite/etatsFinanciers";

/**
 * GET /api/comptable/etats-financiers-reels?annee=2026
 * Bilan, compte de résultat, tableau de flux et notes annexes — calculés
 * exclusivement depuis les écritures comptables validées (CDC §36-39).
 * Lecture seule — ouvert aux rôles de consultation (CDC §43).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getComptableLectureSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const currentYear = new Date().getFullYear();
    const annee = Math.min(currentYear + 1, Math.max(2020, Number(req.nextUrl.searchParams.get("annee") ?? currentYear)));
    const dateDebut = new Date(annee, 0, 1);
    const dateFin = new Date(annee, 11, 31, 23, 59, 59, 999);

    const [bilan, compteResultat, tableauFlux, notesAnnexes, resultatParPointDeVente] = await Promise.all([
      genererBilan(prisma, dateFin),
      genererCompteResultatDetaille(prisma, dateDebut, dateFin),
      genererTableauFluxDetaille(prisma, dateDebut, dateFin),
      genererNotesAnnexes(prisma, dateDebut, dateFin),
      genererResultatParPointDeVente(prisma, dateDebut, dateFin),
    ]);

    return NextResponse.json({ data: { annee, bilan, compteResultat, tableauFlux, notesAnnexes, resultatParPointDeVente } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
