import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genDemandeCongeHtml } from "@/lib/demandeCongeHtml";

// Chromium nécessite le runtime Node (pas Edge) ; génération potentiellement longue.
export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/rh/conges/[id]/pdf
 * Vue imprimable (PDF) d'une demande/autorisation de congé.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const demande = await prisma.demandeConge.findUnique({
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
    if (!demande) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });

    const html = genDemandeCongeHtml({
      ...demande,
      profilRH: {
        matricule: demande.profilRH.matricule,
        fonction: demande.profilRH.fonction,
        departement: demande.profilRH.departement,
        nom: demande.profilRH.gestionnaire.member.nom,
        prenom: demande.profilRH.gestionnaire.member.prenom,
      },
    });
    const pdf = await htmlToPdf(html);
    const filename = `demande-conge-${demande.profilRH.matricule}-${demande.id}.pdf`;
    return pdfResponse(pdf, filename);
  } catch (error) {
    console.error("GET /api/admin/rh/conges/[id]/pdf", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
