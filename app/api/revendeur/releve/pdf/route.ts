import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRevendeurSession } from "@/lib/authRevendeur";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genReleveAchatsRevendeurHtml } from "@/lib/releveAchatsRevendeurHtml";
import { statsAchatsRevendeur } from "@/lib/revendeur";

export const runtime = "nodejs";
export const maxDuration = 30;

/** GET /api/revendeur/releve/pdf — Relevé de compte / État des achats (self-service, CDC §5.6). */
export async function GET() {
  try {
    const session = await getRevendeurSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);
    const profil = await prisma.profilRevendeur.findUnique({ where: { userId }, select: { raisonSociale: true } });
    if (!profil) return NextResponse.json({ error: "Aucun compte revendeur ouvert pour cet utilisateur" }, { status: 404 });

    const factures = await prisma.factureVente.findMany({
      where: { revendeurId: userId },
      orderBy: { dateEmission: "desc" },
      select: { numero: true, statut: true, dateEmission: true, montantTTC: true, montantPaye: true },
    });
    const stats = await statsAchatsRevendeur(userId);

    const html = genReleveAchatsRevendeurHtml({
      raisonSociale: profil.raisonSociale,
      factures: factures.map((f) => ({ numero: f.numero, statut: f.statut, dateEmission: f.dateEmission, montantTTC: Number(f.montantTTC), montantPaye: Number(f.montantPaye) })),
      stats,
    });
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `releve-revendeur-${profil.raisonSociale.replace(/\s+/g, "-")}.pdf`);
  } catch (error) {
    console.error("GET /revendeur/releve/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
