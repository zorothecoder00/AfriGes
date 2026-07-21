import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { htmlToPdf, pdfResponse, wrapHtmlDocument } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/rh/recrutement/documents/[id]/pdf
 * Export PDF (streaming) d'un document de recrutement généré, à partir du HTML stocké.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const doc = await prisma.documentRecrutementGenere.findUnique({
      where:  { id: Number(id) },
      select: { titre: true, contenu: true, version: true },
    });
    if (!doc)         return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
    if (!doc.contenu) return NextResponse.json({ error: "Contenu du document indisponible" }, { status: 400 });

    const html     = wrapHtmlDocument(doc.contenu, doc.titre);
    const pdf      = await htmlToPdf(html);
    const filename = `${doc.titre.replace(/[^\w.-]+/g, "_")}-v${doc.version}.pdf`;
    return pdfResponse(pdf, filename);
  } catch (error) {
    console.error("GET /api/admin/rh/recrutement/documents/[id]/pdf", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
