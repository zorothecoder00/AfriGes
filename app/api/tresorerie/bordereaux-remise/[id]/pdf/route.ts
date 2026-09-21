import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { htmlToPdf, pdfResponse, PDF_A5_PAYSAGE } from "@/lib/pdf";
import { genBordereauRemiseHtml } from "@/lib/bordereauRemiseHtml";
import { qrInstanceUrl, genererQrDataUrl } from "@/lib/documentQr";
import { getSession } from "../../route";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/tresorerie/bordereaux-remise/[id]/pdf
 * Accusé de remise imprimable (PDF) — CDC digitalisation §3.1.
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const bordereau = await prisma.bordereauRemiseFonds.findUnique({
      where: { id: Number(id) },
      include: {
        pointDeVente: { select: { nom: true, code: true } },
        collecteur: { select: { nom: true, prenom: true, telephone: true } },
        tresorier: { select: { nom: true, prenom: true } },
        visaCGTPar: { select: { nom: true, prenom: true } },
        lignesBilletage: true,
      },
    });
    if (!bordereau) return NextResponse.json({ error: "Bordereau introuvable" }, { status: 404 });

    const isTresorierOuAdmin = !!(await getComptableSession());
    if (!isTresorierOuAdmin && bordereau.collecteurId !== parseInt(session.user.id)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const qrUrl = qrInstanceUrl(req, "BRF", bordereau.id, bordereau.createdAt.toISOString());
    const qrDataUrl = await genererQrDataUrl(qrUrl);

    const html = genBordereauRemiseHtml({
      reference: bordereau.reference, statut: bordereau.statut,
      pointDeVente: bordereau.pointDeVente, collecteur: bordereau.collecteur,
      cotisationsEspeces: Number(bordereau.cotisationsEspeces), cotisationsMobileMoney: Number(bordereau.cotisationsMobileMoney),
      mobileMoneyReference: bordereau.mobileMoneyReference,
      remboursements: Number(bordereau.remboursements), ventes: Number(bordereau.ventes), venteCarnet: Number(bordereau.venteCarnet),
      fraisLivraison: Number(bordereau.fraisLivraison),
      montantVirement: Number(bordereau.montantVirement), virementReference: bordereau.virementReference,
      totalEspecesAttendu: Number(bordereau.totalEspecesAttendu),
      lignesBilletage: bordereau.lignesBilletage.map((l) => ({ denomination: l.denomination, nombre: l.nombre, total: Number(l.total) })),
      totalBilletageCalcule: Number(bordereau.totalBilletageCalcule),
      ecartSoumission: Number(bordereau.ecartSoumission), motifEcartSoumission: bordereau.motifEcartSoumission,
      tresorier: bordereau.tresorier,
      montantConfirmeTresorier: bordereau.montantConfirmeTresorier != null ? Number(bordereau.montantConfirmeTresorier) : null,
      dateTraitementTresorier: bordereau.dateTraitementTresorier,
      visaCGTPar: bordereau.visaCGTPar, dateVisaCGT: bordereau.dateVisaCGT,
      depotBancaireReference: bordereau.depotBancaireReference, dateCloture: bordereau.dateCloture,
      qrDataUrl,
    });
    const pdf = await htmlToPdf(html, PDF_A5_PAYSAGE);
    return pdfResponse(pdf, `${bordereau.reference}.pdf`);
  } catch (error) {
    console.error("GET /tresorerie/bordereaux-remise/[id]/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
