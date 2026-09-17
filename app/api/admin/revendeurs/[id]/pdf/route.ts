import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genFicheRevendeurHtml, type VarianteRevendeur } from "@/lib/ficheRevendeurHtml";
import { qrInstanceUrl, genererQrDataUrl } from "@/lib/documentQr";
import { statsAchatsRevendeur } from "@/lib/revendeur";
import { INCLUDE } from "../../route";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

const VARIANTES: VarianteRevendeur[] = ["OUVERTURE", "CARTE", "GRILLE", "CONVENTION", "ATTESTATION"];

/**
 * GET /api/admin/revendeurs/[id]/pdf?variante=OUVERTURE|CARTE|GRILLE|CONVENTION|ATTESTATION
 * Documents du profil revendeur (CDC digitalisation §5.6).
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const profil = await prisma.profilRevendeur.findUnique({ where: { id: Number(id) }, include: INCLUDE });
    if (!profil) return NextResponse.json({ error: "Revendeur introuvable" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const variante = (searchParams.get("variante") as VarianteRevendeur) || "CARTE";
    if (!VARIANTES.includes(variante)) return NextResponse.json({ error: "Variante invalide" }, { status: 400 });

    const stats = variante === "ATTESTATION" ? await statsAchatsRevendeur(profil.userId) : undefined;

    const qrUrl = qrInstanceUrl(req, "REV", profil.id, profil.createdAt.toISOString());
    const qrDataUrl = await genererQrDataUrl(qrUrl);

    const html = genFicheRevendeurHtml(variante, profil, { stats, qrDataUrl });
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `${variante.toLowerCase()}-revendeur-${profil.id}.pdf`);
  } catch (error) {
    console.error("GET /admin/revendeurs/[id]/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
