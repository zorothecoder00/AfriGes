import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableLectureSession } from "@/lib/authComptable";
import { genererCompteResultat } from "@/lib/comptabilite/etatsFinanciers";
import { genResultatPdfHtml } from "@/lib/comptabilite/etatsFinanciersPdf";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 30;

/** GET /api/comptable/etats-financiers/resultat/pdf?annee=2026 — CDC §46. */
export async function GET(req: NextRequest) {
  try {
    const session = await getComptableLectureSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const currentYear = new Date().getFullYear();
    const annee = Math.min(currentYear + 1, Math.max(2020, Number(req.nextUrl.searchParams.get("annee") ?? currentYear)));
    const dateDebut = new Date(annee, 0, 1);
    const dateFin = new Date(annee, 11, 31, 23, 59, 59, 999);

    const cr = await genererCompteResultat(prisma, dateDebut, dateFin);
    const html = genResultatPdfHtml(annee, cr);
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `compte-resultat-${annee}.pdf`, "attachment");
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
