import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getReclamationSession } from "@/lib/authReclamation";
import { resolvePdvIdsAutorises } from "@/lib/reclamationClientServer";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genFicheTraitementReclamationHtml } from "@/lib/ficheTraitementReclamationHtml";
import { qrInstanceUrl, genererQrDataUrl } from "@/lib/documentQr";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/reclamations/[id]/traitement/pdf
 * Fiche de traitement de réclamation, devient la Fiche de clôture une fois
 * la réclamation clôturée (CDC digitalisation §5.8).
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getReclamationSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const reclamation = await prisma.reclamationClient.findUnique({
      where: { id: Number(id) },
      include: {
        client: { select: { nom: true, prenom: true } },
        actions: { include: { auteur: { select: { nom: true, prenom: true } } }, orderBy: { dateAction: "desc" } },
      },
    });
    if (!reclamation) return NextResponse.json({ error: "Réclamation introuvable" }, { status: 404 });

    const pdvIds = await resolvePdvIdsAutorises(session);
    if (pdvIds !== null && (!reclamation.pointDeVenteId || !pdvIds.includes(reclamation.pointDeVenteId))) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const qrUrl = qrInstanceUrl(req, "REC", reclamation.id, reclamation.createdAt.toISOString());
    const qrDataUrl = await genererQrDataUrl(qrUrl);

    const html = genFicheTraitementReclamationHtml({
      numero: reclamation.numero, type: reclamation.type, objet: reclamation.objet, statut: reclamation.statut,
      resumeCloture: reclamation.resumeCloture, clotureLe: reclamation.clotureLe, client: reclamation.client,
      actions: reclamation.actions.map((a) => ({ type: a.type, description: a.description, dateAction: a.dateAction, auteur: a.auteur })),
      qrDataUrl,
    });
    const pdf = await htmlToPdf(html);
    const prefixe = reclamation.statut === "CLOTUREE" ? "cloture" : "traitement";
    return pdfResponse(pdf, `${prefixe}-reclamation-${reclamation.numero}.pdf`);
  } catch (error) {
    console.error("GET /admin/reclamations/[id]/traitement/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
