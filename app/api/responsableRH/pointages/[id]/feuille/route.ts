import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession, profilRHDansPerimetre } from "@/lib/authRH";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genFeuillePointageHtml } from "@/lib/feuillePointageHtml";

// Chromium nécessite le runtime Node (pas Edge) ; génération potentiellement longue.
export const runtime = "nodejs";
export const maxDuration = 30;

// Nom de param aligné sur les routes soeurs pointages/[id]/... (Next.js exige
// le même nom de segment dynamique pour tous les dossiers [x] à ce niveau) ;
// "id" désigne ici un ProfilRH.id, pas un Pointage.id.
type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/responsableRH/pointages/[id]/feuille
 * Feuille de pointage mensuelle imprimable (PDF), scopée au périmètre PDV (id = ProfilRH.id).
 * Query: mois (1-12), annee.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id: profilRHId } = await params;
    if (!(await profilRHDansPerimetre(session, Number(profilRHId)))) {
      return NextResponse.json({ error: "Collaborateur hors de votre périmètre" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const mois  = Number(searchParams.get("mois")  || new Date().getMonth() + 1);
    const annee = Number(searchParams.get("annee") || new Date().getFullYear());

    const debut = new Date(annee, mois - 1, 1);
    const fin   = new Date(annee, mois, 1);

    const profil = await prisma.profilRH.findUnique({
      where: { id: Number(profilRHId) },
      select: {
        matricule: true, fonction: true, departement: true,
        gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
        pointages: {
          where:   { date: { gte: debut, lt: fin }, annule: false },
          orderBy: { date: "asc" },
          select: {
            date: true, statut: true, heureArrivee: true, heureDepart: true,
            tempsTotal: true, retardMinutes: true, heuresSup: true,
            justificatif: true, notes: true,
          },
        },
      },
    });
    if (!profil) return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 });

    const html = genFeuillePointageHtml({
      profilRH: {
        matricule: profil.matricule, fonction: profil.fonction, departement: profil.departement,
        nom: profil.gestionnaire.member.nom, prenom: profil.gestionnaire.member.prenom,
      },
      mois, annee,
      pointages: profil.pointages,
    });
    const pdf = await htmlToPdf(html);
    const filename = `feuille-pointage-${profil.matricule}-${annee}${String(mois).padStart(2, "0")}.pdf`;
    return pdfResponse(pdf, filename);
  } catch (error) {
    console.error("GET /api/responsableRH/pointages/[id]/feuille", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
