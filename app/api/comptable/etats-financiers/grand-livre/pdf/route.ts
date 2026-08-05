import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableLectureSession } from "@/lib/authComptable";
import { genererGrandLivreCompte } from "@/lib/comptabilite/grandLivreBalance";
import { genGrandLivrePdfHtml } from "@/lib/comptabilite/etatsFinanciersPdf";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 30;

/** GET /api/comptable/etats-financiers/grand-livre/pdf?compteId=&dateDebut=&dateFin= — CDC §46. */
export async function GET(req: Request) {
  try {
    const session = await getComptableLectureSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const compteId = Number(searchParams.get("compteId"));
    if (!compteId) return NextResponse.json({ error: "compteId requis" }, { status: 400 });

    const dateDebut = searchParams.get("dateDebut") ? new Date(searchParams.get("dateDebut")!) : null;
    const dateFin = searchParams.get("dateFin") ? new Date(`${searchParams.get("dateFin")}T23:59:59`) : null;

    const data = await genererGrandLivreCompte(prisma, compteId, { dateDebut, dateFin });
    if (!data.compte) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

    const html = genGrandLivrePdfHtml(data.compte, { debut: dateDebut, fin: dateFin }, data.soldeOuverture, data.lignes, data.soldeFinal);
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `grand-livre-${data.compte.numero}.pdf`, "attachment");
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
