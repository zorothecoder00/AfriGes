import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getReclamationSession } from "@/lib/authReclamation";
import { resolvePdvIdsAutorises } from "@/lib/reclamationClientServer";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genFormulaireReclamationHtml } from "@/lib/formulaireReclamationHtml";
import { qrInstanceUrl, genererQrDataUrl } from "@/lib/documentQr";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/reclamations/[id]/pdf — Formulaire de réclamation client (CDC digitalisation §5.8). */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getReclamationSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const reclamation = await prisma.reclamationClient.findUnique({
      where: { id: Number(id) },
      include: {
        client: { select: { nom: true, prenom: true, telephone: true, codeClient: true } },
        pointDeVente: { select: { nom: true, code: true } },
        creePar: { select: { nom: true, prenom: true } },
        lignes: { include: { produit: { select: { nom: true } } } },
      },
    });
    if (!reclamation) return NextResponse.json({ error: "Réclamation introuvable" }, { status: 404 });

    const pdvIds = await resolvePdvIdsAutorises(session);
    if (pdvIds !== null && (!reclamation.pointDeVenteId || !pdvIds.includes(reclamation.pointDeVenteId))) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const qrUrl = qrInstanceUrl(req, "REC", reclamation.id, reclamation.createdAt.toISOString());
    const qrDataUrl = await genererQrDataUrl(qrUrl);

    const html = genFormulaireReclamationHtml({
      numero: reclamation.numero, type: reclamation.type, objet: reclamation.objet, description: reclamation.description,
      statut: reclamation.statut, sourceReference: reclamation.sourceReference, createdAt: reclamation.createdAt,
      client: reclamation.client, pointDeVente: reclamation.pointDeVente, creePar: reclamation.creePar,
      lignes: reclamation.lignes.map((l) => ({ produit: l.produit, quantite: l.quantite, motif: l.motif })),
      qrDataUrl,
    });
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `reclamation-${reclamation.numero}.pdf`);
  } catch (error) {
    console.error("GET /admin/reclamations/[id]/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
