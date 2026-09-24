import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getComptableSession } from "@/lib/authComptable";
import { getCaissierSession, getCaissierPdvId } from "@/lib/authCaissier";
import { prisma } from "@/lib/prisma";
import { htmlToPdf, pdfResponse, imagePubliqueDataUrl, PDF_A4_PAYSAGE_FORMULAIRE } from "@/lib/pdf";
import { genFicheCollecteHtml } from "@/lib/ficheCollecteHtml";
import { chargerFicheCollecte } from "@/lib/ficheCollecteServer";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/collectes/[id]/fiche
 * Fiche journalière de collecte (PDF) d'une CollecteJournaliere — agent (ses collectes),
 * comptable/admin, caissier ou RPV de l'agence.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const fiche = await chargerFicheCollecte(Number(id));
    if (!fiche) return NextResponse.json({ error: "Collecte introuvable" }, { status: 404 });

    const userId = parseInt(session.user.id);
    let autorise = fiche.agentId === userId || !!(await getComptableSession());
    if (!autorise && fiche.pointDeVenteId && (await getCaissierSession())) {
      autorise = (await getCaissierPdvId(userId)) === fiche.pointDeVenteId;
    }
    if (!autorise && fiche.pointDeVenteId && session.user.gestionnaireRole === "RESPONSABLE_POINT_DE_VENTE") {
      const pdv = await prisma.pointDeVente.findUnique({ where: { id: fiche.pointDeVenteId }, select: { rpvId: true } });
      autorise = pdv?.rpvId === userId;
    }
    if (!autorise) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const html = genFicheCollecteHtml({ ...fiche, logoDataUrl: await imagePubliqueDataUrl("nouveaulogo.jpeg", "image/jpeg") });
    const pdf = await htmlToPdf(html, PDF_A4_PAYSAGE_FORMULAIRE);
    return pdfResponse(pdf, `Fiche-collecte-${fiche.reference ?? id}.pdf`);
  } catch (error) {
    console.error("GET /collectes/[id]/fiche:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
