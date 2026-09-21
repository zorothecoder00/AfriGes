import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getReclamationSession } from "@/lib/authReclamation";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { resolvePdvIdsAutorises } from "@/lib/reclamationClientServer";
import { htmlToPdf, pdfResponse, PDF_A5_PAYSAGE } from "@/lib/pdf";
import { genBonRemplacementHtml } from "@/lib/bonRemplacementHtml";
import { qrInstanceUrl, genererQrDataUrl } from "@/lib/documentQr";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string; remplacementId: string }> };

/**
 * GET /api/admin/reclamations/[id]/remplacements/[remplacementId]/pdf
 * Bon de remplacement (CDC digitalisation §5.8). Accessible au Service
 * Commercial comme au Magasinier qui l'exécute.
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const reclamationSession = await getReclamationSession();
    const magasinierSession = reclamationSession ? null : await getMagasinierSession();
    const session = reclamationSession ?? magasinierSession;
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, remplacementId } = await params;
    const remplacement = await prisma.remplacementProduit.findUnique({
      where: { id: Number(remplacementId) },
      include: {
        produitOrigine: { select: { nom: true } },
        produitRemplacement: { select: { nom: true } },
        reclamation: { select: { id: true, numero: true, pointDeVenteId: true, client: { select: { nom: true, prenom: true } } } },
        magasinier: { select: { nom: true, prenom: true } },
      },
    });
    if (!remplacement || remplacement.reclamation.id !== Number(id)) return NextResponse.json({ error: "Remplacement introuvable" }, { status: 404 });

    if (reclamationSession) {
      const pdvIds = await resolvePdvIdsAutorises(reclamationSession);
      if (pdvIds !== null && (!remplacement.reclamation.pointDeVenteId || !pdvIds.includes(remplacement.reclamation.pointDeVenteId))) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    const qrUrl = qrInstanceUrl(req, "BRM", remplacement.id, remplacement.createdAt.toISOString());
    const qrDataUrl = await genererQrDataUrl(qrUrl);

    const html = genBonRemplacementHtml({
      numero: remplacement.numero, statut: remplacement.statut, quantite: remplacement.quantite,
      dateLivraison: remplacement.dateLivraison, motifRejet: remplacement.motifRejet,
      produitOrigine: remplacement.produitOrigine, produitRemplacement: remplacement.produitRemplacement,
      reclamation: remplacement.reclamation, magasinier: remplacement.magasinier,
      qrDataUrl,
    });
    const pdf = await htmlToPdf(html, PDF_A5_PAYSAGE);
    return pdfResponse(pdf, `remplacement-${remplacement.numero}.pdf`);
  } catch (error) {
    console.error("GET /admin/reclamations/[id]/remplacements/[remplacementId]/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
