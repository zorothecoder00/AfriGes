import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableLectureSession } from "@/lib/authComptable";
import { genererBilan } from "@/lib/comptabilite/etatsFinanciers";
import { genBilanPdfHtml } from "@/lib/comptabilite/etatsFinanciersPdf";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 30;

/** GET /api/comptable/etats-financiers/bilan/pdf?annee=2026 — CDC §46. */
export async function GET(req: NextRequest) {
  try {
    const session = await getComptableLectureSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const currentYear = new Date().getFullYear();
    const annee = Math.min(currentYear + 1, Math.max(2020, Number(req.nextUrl.searchParams.get("annee") ?? currentYear)));
    const dateFin = new Date(annee, 11, 31, 23, 59, 59, 999);

    const bilan = await genererBilan(prisma, dateFin);
    const html = genBilanPdfHtml(annee, bilan);
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `bilan-${annee}.pdf`, "attachment");
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
