import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genFicheActionRecouvrementHtml } from "@/lib/ficheActionRecouvrementHtml";
import { qrInstanceUrl, genererQrDataUrl } from "@/lib/documentQr";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string; actionId: string }> };

/**
 * GET /api/admin/credits/[id]/recouvrement/[actionId]/pdf
 * Fiche d'action de recouvrement (CDC digitalisation §5.4) — couvre Mise en
 * demeure et Fiche de visite de recouvrement, plus un compte-rendu générique
 * pour les autres types d'action.
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, actionId } = await params;
    const creditId = Number(id);
    const action = await prisma.actionRecouvrementCredit.findUnique({
      where: { id: Number(actionId) },
      include: {
        credit: {
          select: { id: true, reference: true, soldeRestant: true, createdAt: true, client: { select: { nom: true, prenom: true, codeClient: true, telephone: true, adresse: true } } },
        },
        effectuePar: { select: { nom: true, prenom: true } },
      },
    });
    if (!action || action.credit.id !== creditId) {
      return NextResponse.json({ error: "Action introuvable" }, { status: 404 });
    }

    const isMED = action.type === "MISE_EN_DEMEURE";
    const isVisite = action.type === "VISITE_TERRAIN";
    const prefixe = isMED ? "MED" : isVisite ? "FVR" : "REC";

    const qrUrl = qrInstanceUrl(req, "ARC", action.credit.id, action.credit.createdAt.toISOString());
    const qrDataUrl = await genererQrDataUrl(qrUrl);

    const html = genFicheActionRecouvrementHtml({
      numeroDocument: `${prefixe}-${action.credit.reference}-${action.id}`,
      type: action.type,
      statut: action.statut,
      notes: action.notes,
      resultat: action.resultat,
      delaiRegularisationJours: action.delaiRegularisationJours,
      lieuVisite: action.lieuVisite,
      personneRencontree: action.personneRencontree,
      effectuePar: action.effectuePar,
      dateAction: action.dateAction,
      dateRelance: action.dateRelance,
      creditReference: action.credit.reference,
      soldeRestant: Number(action.credit.soldeRestant),
      client: action.credit.client,
      qrDataUrl,
    });
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `${prefixe.toLowerCase()}-${action.credit.reference}-${action.id}.pdf`);
  } catch (error) {
    console.error("GET /admin/credits/[id]/recouvrement/[actionId]/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
