import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genAttestationSoldeHtml } from "@/lib/attestationSoldeHtml";
import { qrInstanceUrl, genererQrDataUrl } from "@/lib/documentQr";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/credits/[id]/attestation-solde/pdf
 * Attestation de solde / quittance finale (CDC digitalisation §5.4) —
 * uniquement disponible une fois le crédit intégralement remboursé (SOLDE).
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const credit = await prisma.creditClient.findUnique({
      where: { id: Number(id) },
      include: {
        client: { select: { nom: true, prenom: true, codeClient: true, telephone: true } },
        gestionnaireCredit: { select: { nom: true, prenom: true } },
        remboursements: { where: { statut: "CONFIRME" }, orderBy: { dateRemboursement: "desc" }, take: 1, select: { dateRemboursement: true } },
      },
    });
    if (!credit) return NextResponse.json({ error: "Crédit introuvable" }, { status: 404 });
    if (credit.statut !== "SOLDE") {
      return NextResponse.json({ error: "L'attestation de solde n'est disponible qu'une fois le crédit intégralement remboursé" }, { status: 409 });
    }

    const qrUrl = qrInstanceUrl(req, "ASF", credit.id, credit.createdAt.toISOString());
    const qrDataUrl = await genererQrDataUrl(qrUrl);

    const html = genAttestationSoldeHtml({
      reference: credit.reference,
      client: credit.client,
      montantTotal: Number(credit.montantTotal),
      dateDebut: credit.dateDebut,
      dateSolde: credit.remboursements[0]?.dateRemboursement ?? credit.updatedAt,
      gestionnaire: credit.gestionnaireCredit,
      qrDataUrl,
    });
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `attestation-solde-${credit.reference}.pdf`);
  } catch (error) {
    console.error("GET /admin/credits/[id]/attestation-solde/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
