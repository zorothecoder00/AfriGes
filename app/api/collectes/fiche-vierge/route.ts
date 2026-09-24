import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { htmlToPdf, pdfResponse, imagePubliqueDataUrl, PDF_A4_PAYSAGE_FORMULAIRE } from "@/lib/pdf";
import { genFicheCollecteHtml, ficheCollecteVierge } from "@/lib/ficheCollecteHtml";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/collectes/fiche-vierge
 * Fiche journalière de collecte vierge (PDF) — à imprimer et remplir à la main sur le terrain.
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const html = genFicheCollecteHtml(ficheCollecteVierge(await imagePubliqueDataUrl("nouveaulogo.jpeg", "image/jpeg")));
    const pdf = await htmlToPdf(html, PDF_A4_PAYSAGE_FORMULAIRE);
    return pdfResponse(pdf, "Fiche-collecte-vierge.pdf");
  } catch (error) {
    console.error("GET /collectes/fiche-vierge:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
