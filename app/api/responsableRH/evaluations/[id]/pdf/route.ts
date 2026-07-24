import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession, profilRHDansPerimetre } from "@/lib/authRH";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genEvaluationHtml } from "@/lib/evaluationHtml";

// Chromium nécessite le runtime Node (pas Edge) ; génération potentiellement longue.
export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/responsableRH/evaluations/[id]/pdf
 * Fiche d'évaluation imprimable (PDF).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const evaluation = await prisma.evaluationRH.findUnique({
      where: { id: Number(id) },
      include: {
        criteres: true,
        objectifs: { where: { actif: true } },
        actionsDeveloppement: true,
        profilRH: {
          select: {
            matricule: true, fonction: true, departement: true,
            gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
          },
        },
        evaluateur: {
          select: { gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } } },
        },
      },
    });
    if (!evaluation) return NextResponse.json({ error: "Évaluation introuvable" }, { status: 404 });
    if (!(await profilRHDansPerimetre(session, evaluation.profilRHId))) {
      return NextResponse.json({ error: "Évaluation hors de votre périmètre" }, { status: 403 });
    }

    const html = genEvaluationHtml({
      ...evaluation,
      noteGlobale: evaluation.noteGlobale ? evaluation.noteGlobale.toString() : null,
      profilRH: {
        matricule: evaluation.profilRH.matricule,
        fonction: evaluation.profilRH.fonction,
        departement: evaluation.profilRH.departement,
        nom: evaluation.profilRH.gestionnaire.member.nom,
        prenom: evaluation.profilRH.gestionnaire.member.prenom,
      },
      evaluateur: evaluation.evaluateur ? evaluation.evaluateur.gestionnaire.member : null,
      criteres: evaluation.criteres.map((c) => ({ libelle: c.libelle, note: c.note.toString(), commentaire: c.commentaire })),
      objectifs: evaluation.objectifs.map((o) => ({
        libelle: o.libelle, indicateur: o.indicateur, valeurCible: o.valeurCible.toString(),
        valeurAtteinte: o.valeurAtteinte ? o.valeurAtteinte.toString() : null, unite: o.unite, poids: o.poids,
      })),
      actionsDeveloppement: evaluation.actionsDeveloppement.map((a) => ({
        objectif: a.objectif, actionPrevue: a.actionPrevue, echeance: a.echeance, statut: a.statut,
      })),
    });
    const pdf = await htmlToPdf(html);
    const filename = `evaluation-${evaluation.profilRH.matricule}-${evaluation.annee}.pdf`;
    return pdfResponse(pdf, filename);
  } catch (error) {
    console.error("GET /api/responsableRH/evaluations/[id]/pdf", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
