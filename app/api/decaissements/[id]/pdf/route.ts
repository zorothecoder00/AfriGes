import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { getComptableSession } from "@/lib/authComptable";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genDecaissementHtml } from "@/lib/decaissementHtml";
import { qrInstanceUrl, genererQrDataUrl } from "@/lib/documentQr";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const fiche = await prisma.ficheDecaissement.findUnique({
      where: { id: Number(id) },
      include: {
        demandeur: { select: { nom: true, prenom: true } },
        approbateurN1: { select: { nom: true, prenom: true } },
        approbateurN2: { select: { nom: true, prenom: true } },
        executePar: { select: { nom: true, prenom: true } },
      },
    });
    if (!fiche) return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });

    const isComptableOuAdmin = !!(await getComptableSession());
    if (!isComptableOuAdmin && fiche.demandeurId !== parseInt(session.user.id)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const qrUrl = qrInstanceUrl(req, "FD", fiche.id, fiche.createdAt.toISOString());
    const qrDataUrl = await genererQrDataUrl(qrUrl);

    const html = genDecaissementHtml({
      reference: fiche.reference, statut: fiche.statut,
      demandeur: fiche.demandeur, beneficiaireNom: fiche.beneficiaireNom, beneficiaireContact: fiche.beneficiaireContact,
      motif: fiche.motif, typeDepense: fiche.typeDepense,
      montantDemande: Number(fiche.montantDemande), montantApprouve: fiche.montantApprouve != null ? Number(fiche.montantApprouve) : null,
      motifEcartMontant: fiche.motifEcartMontant,
      modePaiement: fiche.modePaiement, referencePaiement: fiche.referencePaiement,
      piecesJustificatives: fiche.piecesJustificatives,
      approbateurN1: fiche.approbateurN1, dateApprobationN1: fiche.dateApprobationN1,
      approbateurN2: fiche.approbateurN2, dateApprobationN2: fiche.dateApprobationN2,
      executePar: fiche.executePar, dateExecution: fiche.dateExecution,
      beneficiaireConfirmationNom: fiche.beneficiaireConfirmationNom, dateConfirmationBeneficiaire: fiche.dateConfirmationBeneficiaire,
      qrDataUrl,
    });
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `${fiche.reference}.pdf`);
  } catch (error) {
    console.error("GET /decaissements/[id]/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
