import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genFeuillePresenceFormationHtml } from "@/lib/feuillePresenceFormationHtml";

// Chromium nécessite le runtime Node (pas Edge) ; génération potentiellement longue.
export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/responsableRH/formations/[id]/feuille-presence
 * Feuille de présence imprimable (PDF) pour une session de formation,
 * listant tous les participants inscrits.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const formation = await prisma.formation.findUnique({
      where: { id: Number(id) },
      include: {
        participations: {
          include: {
            profilRH: {
              select: {
                matricule: true, fonction: true,
                gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
              },
            },
          },
        },
      },
    });
    if (!formation) return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });

    const html = genFeuillePresenceFormationHtml({
      id: formation.id, titre: formation.titre, lieu: formation.lieu, formateur: formation.formateur,
      dateDebut: formation.dateDebut, dateFin: formation.dateFin, dureeHeures: formation.dureeHeures,
      participants: formation.participations.map((p) => ({
        matricule: p.profilRH.matricule, fonction: p.profilRH.fonction,
        nom: p.profilRH.gestionnaire.member.nom, prenom: p.profilRH.gestionnaire.member.prenom,
      })),
    });
    const pdf = await htmlToPdf(html);
    const filename = `feuille-presence-formation-${formation.id}.pdf`;
    return pdfResponse(pdf, filename);
  } catch (error) {
    console.error("GET /api/responsableRH/formations/[id]/feuille-presence", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
