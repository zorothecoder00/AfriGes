import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genDevisProformaHtml } from "@/lib/devisProformaHtml";
import { qrInstanceUrl, genererQrDataUrl } from "@/lib/documentQr";
import { getCreateSession } from "../../route";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getCreateSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const document = await prisma.devisProforma.findUnique({
      where: { id: Number(id) },
      include: {
        agent: { select: { nom: true, prenom: true } },
        pointDeVente: { select: { nom: true, code: true } },
        client: { select: { nom: true, prenom: true, telephone: true, adresse: true } },
        lignes: { include: { produit: { select: { nom: true } } } },
      },
    });
    if (!document) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    if (!isAdmin && document.agentId !== parseInt(session.user.id)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const qrUrl = qrInstanceUrl(req, document.type === "PROFORMA" ? "PRO" : "DEV", document.id, document.createdAt.toISOString());
    const qrDataUrl = await genererQrDataUrl(qrUrl);

    const html = genDevisProformaHtml({
      reference: document.reference, type: document.type, statut: document.statut,
      agent: document.agent, pointDeVente: document.pointDeVente, client: document.client,
      dateValidite: document.dateValidite, conditions: document.conditions,
      lignes: document.lignes.map((l) => ({ produitNom: l.produit.nom, quantite: l.quantite, prixUnitaire: Number(l.prixUnitaire), remiseMontant: Number(l.remiseMontant), totalLigne: Number(l.totalLigne) })),
      totalHT: Number(document.totalHT), totalRemise: Number(document.totalRemise), totalTVA: Number(document.totalTVA), totalTTC: Number(document.totalTTC),
      nomSignataireReponse: document.nomSignataireReponse, dateReponse: document.dateReponse,
      qrDataUrl,
    });
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `${document.reference}.pdf`);
  } catch (error) {
    console.error("GET /ventes/devis-proforma/[id]/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
