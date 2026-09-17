import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genRecuRemboursementHtml } from "@/lib/recuRemboursementHtml";
import { qrInstanceUrl, genererQrDataUrl } from "@/lib/documentQr";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string; rembId: string }> };

/** GET /api/admin/credits/[id]/remboursements/[rembId]/pdf — Reçu de remboursement (CDC §5.4). */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, rembId } = await params;
    const creditId = Number(id);
    const remboursement = await prisma.remboursementCredit.findUnique({
      where: { id: Number(rembId) },
      include: {
        credit: {
          select: { id: true, reference: true, soldeRestant: true, createdAt: true, client: { select: { nom: true, prenom: true, codeClient: true, telephone: true } } },
        },
        agentCollecteur: { select: { nom: true, prenom: true } },
        enregistrePar: { select: { nom: true, prenom: true } },
      },
    });
    if (!remboursement || remboursement.credit.id !== creditId) {
      return NextResponse.json({ error: "Remboursement introuvable" }, { status: 404 });
    }

    const qrUrl = qrInstanceUrl(req, "RRC", remboursement.credit.id, remboursement.credit.createdAt.toISOString());
    const qrDataUrl = await genererQrDataUrl(qrUrl);

    const html = genRecuRemboursementHtml({
      numeroRecu: `REC-${remboursement.credit.reference}-${remboursement.id}`,
      creditReference: remboursement.credit.reference,
      client: remboursement.credit.client,
      montant: Number(remboursement.montant),
      dateRemboursement: remboursement.dateRemboursement,
      modePaiement: remboursement.modePaiement,
      numeroJour: remboursement.numeroJour,
      notes: remboursement.notes,
      soldeRestant: Number(remboursement.credit.soldeRestant),
      collectePar: remboursement.agentCollecteur ?? remboursement.enregistrePar,
      qrDataUrl,
    });
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `recu-${remboursement.credit.reference}-${remboursement.id}.pdf`);
  } catch (error) {
    console.error("GET /admin/credits/[id]/remboursements/[rembId]/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
