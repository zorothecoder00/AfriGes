import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionLivraison } from "@/lib/tourneeLivraison";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genFicheArretLivraisonHtml } from "@/lib/ficheArretLivraisonHtml";
import { qrInstanceUrl, genererQrDataUrl } from "@/lib/documentQr";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string; arretId: string }> };

/** GET /api/logistique/tournees/[id]/arrets/[arretId]/pdf — Constat d'arrêt (CDC digitalisation §5.7). */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getSessionLivraison();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, arretId } = await params;
    const arret = await prisma.tourneeArret.findUnique({
      where: { id: Number(arretId) },
      include: { retourLignes: { include: { produit: { select: { nom: true, codeProduit: true } } } }, tournee: { select: { id: true, reference: true } } },
    });
    if (!arret || arret.tourneeId !== Number(id)) return NextResponse.json({ error: "Arrêt introuvable" }, { status: 404 });

    const qrUrl = qrInstanceUrl(req, "ARL", arret.id, arret.createdAt.toISOString());
    const qrDataUrl = await genererQrDataUrl(qrUrl);

    const html = genFicheArretLivraisonHtml({
      ordre: arret.ordre, statut: arret.statut, clientNom: arret.clientNom, clientTelephone: arret.clientTelephone, adresseLivraison: arret.adresseLivraison,
      heureArrivee: arret.heureArrivee, motifNonEffectue: arret.motifNonEffectue, incidentDescription: arret.incidentDescription, signatureClientNom: arret.signatureClientNom,
      retourLignes: arret.retourLignes.map((r) => ({ quantite: r.quantite, motif: r.motif, produit: r.produit })),
      tourneeReference: arret.tournee.reference, qrDataUrl,
    });
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `arret-${arret.tournee.reference}-${arret.ordre}.pdf`);
  } catch (error) {
    console.error("GET /logistique/tournees/[id]/arrets/[arretId]/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
