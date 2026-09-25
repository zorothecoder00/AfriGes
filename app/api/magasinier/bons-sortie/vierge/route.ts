import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getPdvForUser } from "@/lib/viewAs";
import { prisma } from "@/lib/prisma";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genBonSortieViergeHtml } from "@/lib/bonSortieHtml";
import { getSeuilVisaBonSortie } from "@/lib/parametresDocuments";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/magasinier/bons-sortie/vierge
 * Bon de sortie vierge (PDF) à imprimer et remplir à la main. Le point de vente de
 * l'utilisateur est pré-imprimé s'il est affecté à un PDV. Tout utilisateur connecté
 * (magasinier, agent terrain, RPV…) : le document ne contient aucune donnée.
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const pdvId = await getPdvForUser(parseInt(session.user.id));
    const [pointDeVente, seuilVisa] = await Promise.all([
      pdvId ? prisma.pointDeVente.findUnique({ where: { id: pdvId }, select: { nom: true, code: true } }) : null,
      getSeuilVisaBonSortie(),
    ]);

    const pdf = await htmlToPdf(genBonSortieViergeHtml({ seuilVisa, pointDeVente }));
    return pdfResponse(pdf, "Bon-de-sortie-vierge.pdf");
  } catch (error) {
    console.error("GET /magasinier/bons-sortie/vierge:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
