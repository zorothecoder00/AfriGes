import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genDeclarationAccidentHtml } from "@/lib/declarationAccidentHtml";

// Chromium nécessite le runtime Node (pas Edge) ; génération potentiellement longue.
export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/rh/sst/accidents/[id]/declaration
 * Déclaration / rapport d'accident du travail imprimable (PDF), générée
 * depuis les champs déjà enregistrés (pas de saisie supplémentaire).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const accident = await prisma.accidentTravail.findUnique({
      where: { id: Number(id) },
      include: {
        profilRH: {
          select: {
            matricule: true, fonction: true, departement: true,
            gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
          },
        },
      },
    });
    if (!accident) return NextResponse.json({ error: "Accident introuvable" }, { status: 404 });

    const declarePar = await prisma.user.findUnique({
      where: { id: accident.declareParId },
      select: { nom: true, prenom: true },
    });

    const html = genDeclarationAccidentHtml({
      ...accident,
      profilRH: {
        matricule: accident.profilRH.matricule,
        fonction: accident.profilRH.fonction,
        departement: accident.profilRH.departement,
        nom: accident.profilRH.gestionnaire.member.nom,
        prenom: accident.profilRH.gestionnaire.member.prenom,
      },
      declarePar,
    });
    const pdf = await htmlToPdf(html);
    const filename = `declaration-accident-${accident.id}.pdf`;
    return pdfResponse(pdf, filename);
  } catch (error) {
    console.error("GET /api/admin/rh/sst/accidents/[id]/declaration", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
