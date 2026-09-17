import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genAvisEcheanceHtml } from "@/lib/avisEcheanceHtml";
import { qrInstanceUrl, genererQrDataUrl } from "@/lib/documentQr";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/credits/[id]/avis-echeance/pdf
 * Avis d'échéance / avis de retard (CDC digitalisation §5.4) — calculé à la
 * volée : échéances impayées et échues → variante RETARD ; sinon la
 * prochaine échéance non payée → variante ECHEANCE.
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const credit = await prisma.creditClient.findUnique({
      where: { id: Number(id) },
      include: {
        client: { select: { nom: true, prenom: true, codeClient: true, telephone: true } },
        echeances: { orderBy: { numeroEcheance: "asc" }, select: { numeroEcheance: true, dateEcheance: true, montantDu: true, montantPaye: true, statut: true } },
      },
    });
    if (!credit) return NextResponse.json({ error: "Crédit introuvable" }, { status: 404 });

    const now = new Date();
    const impayees = credit.echeances.filter((e) => e.statut !== "PAYE" && new Date(e.dateEcheance) < now);
    const base = impayees.length > 0
      ? impayees
      : credit.echeances.filter((e) => e.statut !== "PAYE").slice(0, 1);
    if (base.length === 0) return NextResponse.json({ error: "Aucune échéance à notifier" }, { status: 409 });

    const variante: "ECHEANCE" | "RETARD" = impayees.length > 0 ? "RETARD" : "ECHEANCE";
    const echeances = base.map((e) => ({
      numeroEcheance: e.numeroEcheance,
      dateEcheance: e.dateEcheance,
      montantDu: Number(e.montantDu),
      montantPaye: Number(e.montantPaye),
      joursRetard: Math.max(0, Math.floor((now.getTime() - new Date(e.dateEcheance).getTime()) / 86_400_000)),
    }));

    const qrUrl = qrInstanceUrl(req, "AEC", credit.id, credit.createdAt.toISOString());
    const qrDataUrl = await genererQrDataUrl(qrUrl);

    const html = genAvisEcheanceHtml({
      numeroAvis: `${variante === "RETARD" ? "AVR" : "AVE"}-${credit.reference}-${Date.now().toString().slice(-6)}`,
      variante, creditReference: credit.reference, client: credit.client, echeances, qrDataUrl,
    });
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `avis-${variante.toLowerCase()}-${credit.reference}.pdf`);
  } catch (error) {
    console.error("GET /admin/credits/[id]/avis-echeance/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
