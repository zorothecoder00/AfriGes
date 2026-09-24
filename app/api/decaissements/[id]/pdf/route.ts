import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { getComptableSession } from "@/lib/authComptable";
import { getCaissierSession } from "@/lib/authCaissier";
import { htmlToPdf, pdfResponse, imagePubliqueDataUrl } from "@/lib/pdf";
import { genDecaissementHtml } from "@/lib/decaissementHtml";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/decaissements/[id]/pdf
 * Fiche de décaissement imprimable — reproduit le formulaire papier AfriSime
 * (A4 portrait, 2 pages ; voir lib/decaissementHtml.ts).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const fiche = await prisma.ficheDecaissement.findUnique({
      where: { id: Number(id) },
      include: {
        demandeur: { select: { nom: true, prenom: true } },
        pointDeVente: { select: { nom: true } },
        approbateurN1: { select: { nom: true, prenom: true } },
        approbateurN2: { select: { nom: true, prenom: true } },
        executePar: { select: { nom: true, prenom: true } },
      },
    });
    if (!fiche) return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });

    // Comptable/admin, demandeur, ou caissier (exécutant des paiements).
    const autorise = !!(await getComptableSession())
      || fiche.demandeurId === parseInt(session.user.id)
      || !!(await getCaissierSession());
    if (!autorise) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const [logoGaucheDataUrl, logoDroitDataUrl] = await Promise.all([
      imagePubliqueDataUrl("nouveaulogo.jpeg", "image/jpeg"),
      imagePubliqueDataUrl("afrisime-logo.svg", "image/svg+xml"),
    ]);

    const html = genDecaissementHtml({
      reference: fiche.reference, date: fiche.createdAt,
      serviceDepartement: fiche.serviceDepartement ?? fiche.pointDeVente?.nom ?? null,
      demandeur: fiche.demandeur,
      beneficiaireNom: fiche.beneficiaireNom, beneficiaireContact: fiche.beneficiaireContact,
      motif: fiche.motif, typeDepense: fiche.typeDepense, typeDepenseAutre: fiche.typeDepenseAutre,
      montantDemande: Number(fiche.montantDemande),
      montantApprouve: fiche.montantApprouve != null ? Number(fiche.montantApprouve) : null,
      modePaiement: fiche.modePaiement, referencePaiement: fiche.referencePaiement,
      piecesJustificatives: fiche.piecesJustificatives,
      approbateurN1: fiche.approbateurN1, dateApprobationN1: fiche.dateApprobationN1,
      approbateurN2: fiche.approbateurN2, dateApprobationN2: fiche.dateApprobationN2,
      executePar: fiche.executePar, dateExecution: fiche.dateExecution,
      beneficiaireConfirmationNom: fiche.beneficiaireConfirmationNom,
      beneficiaireConfirmationPiece: fiche.beneficiaireConfirmationPiece,
      dateConfirmationBeneficiaire: fiche.dateConfirmationBeneficiaire,
      signatureDemandeur: fiche.signatureDemandeur, signatureN1: fiche.signatureN1, signatureN2: fiche.signatureN2,
      signatureExecutant: fiche.signatureExecutant, signatureBeneficiaire: fiche.signatureBeneficiaire,
      logoGaucheDataUrl, logoDroitDataUrl,
    });
    const pdf = await htmlToPdf(html, {
      format: "A4", landscape: false, scale: 1,
      margin: { top: "12mm", right: "14mm", bottom: "12mm", left: "14mm" },
    });
    return pdfResponse(pdf, `${fiche.reference}.pdf`);
  } catch (error) {
    console.error("GET /decaissements/[id]/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
