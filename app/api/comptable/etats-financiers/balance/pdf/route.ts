import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableLectureSession } from "@/lib/authComptable";
import { genererBalanceGenerale } from "@/lib/comptabilite/grandLivreBalance";
import { genBalancePdfHtml } from "@/lib/comptabilite/etatsFinanciersPdf";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/comptable/etats-financiers/balance/pdf
 * Query : dateDebut, dateFin (défaut : année civile en cours), mêmes filtres que
 * la balance JSON. CDC §46.
 */
export async function GET(req: Request) {
  try {
    const session = await getComptableLectureSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const now = new Date();
    const dateDebut = searchParams.get("dateDebut") ? new Date(searchParams.get("dateDebut")!) : new Date(now.getFullYear(), 0, 1);
    const dateFin = searchParams.get("dateFin") ? new Date(`${searchParams.get("dateFin")}T23:59:59`) : now;
    const compteId = searchParams.get("compteId") ? Number(searchParams.get("compteId")) : undefined;
    const classe = searchParams.get("classe") ? Number(searchParams.get("classe")) : undefined;
    const journal = searchParams.get("journal") || undefined;
    const pointDeVenteId = searchParams.get("pointDeVenteId") ? Number(searchParams.get("pointDeVenteId")) : undefined;
    const sectionAnalytiqueId = searchParams.get("sectionAnalytiqueId") ? Number(searchParams.get("sectionAnalytiqueId")) : undefined;
    const tiersTypeRaw = searchParams.get("tiersType");
    const tiersType = tiersTypeRaw === "CLIENT" || tiersTypeRaw === "FOURNISSEUR" ? tiersTypeRaw : undefined;

    const lignes = await genererBalanceGenerale(prisma, {
      dateDebut, dateFin, compteId, classe, journal, pointDeVenteId, sectionAnalytiqueId, tiersType,
    });
    const html = genBalancePdfHtml({ debut: dateDebut, fin: dateFin }, lignes);
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `balance-generale.pdf`, "attachment");
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
