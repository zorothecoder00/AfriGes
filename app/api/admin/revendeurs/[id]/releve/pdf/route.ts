import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genReleveAchatsRevendeurHtml } from "@/lib/releveAchatsRevendeurHtml";
import { statsAchatsRevendeur } from "@/lib/revendeur";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/revendeurs/[id]/releve/pdf — Relevé de compte / État des achats (CDC §5.6). */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const profil = await prisma.profilRevendeur.findUnique({ where: { id: Number(id) }, select: { userId: true, raisonSociale: true } });
    if (!profil) return NextResponse.json({ error: "Revendeur introuvable" }, { status: 404 });

    const factures = await prisma.factureVente.findMany({
      where: { revendeurId: profil.userId },
      orderBy: { dateEmission: "desc" },
      select: { numero: true, statut: true, dateEmission: true, montantTTC: true, montantPaye: true },
    });
    const stats = await statsAchatsRevendeur(profil.userId);

    const html = genReleveAchatsRevendeurHtml({
      raisonSociale: profil.raisonSociale,
      factures: factures.map((f) => ({ numero: f.numero, statut: f.statut, dateEmission: f.dateEmission, montantTTC: Number(f.montantTTC), montantPaye: Number(f.montantPaye) })),
      stats,
    });
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `releve-revendeur-${profil.raisonSociale.replace(/\s+/g, "-")}.pdf`);
  } catch (error) {
    console.error("GET /admin/revendeurs/[id]/releve/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
