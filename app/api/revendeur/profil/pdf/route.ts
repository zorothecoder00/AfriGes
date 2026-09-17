import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRevendeurSession } from "@/lib/authRevendeur";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genFicheRevendeurHtml, type VarianteRevendeur } from "@/lib/ficheRevendeurHtml";
import { qrInstanceUrl, genererQrDataUrl } from "@/lib/documentQr";
import { statsAchatsRevendeur } from "@/lib/revendeur";
import { INCLUDE } from "@/app/api/admin/revendeurs/route";

export const runtime = "nodejs";
export const maxDuration = 30;

const VARIANTES: VarianteRevendeur[] = ["OUVERTURE", "CARTE", "GRILLE", "CONVENTION", "ATTESTATION"];

/**
 * GET /api/revendeur/profil/pdf?variante=OUVERTURE|CARTE|GRILLE|CONVENTION|ATTESTATION
 * Documents du profil revendeur — espace self-service (CDC digitalisation §5.6).
 */
export async function GET(req: Request) {
  try {
    const session = await getRevendeurSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);
    const profil = await prisma.profilRevendeur.findUnique({ where: { userId }, include: INCLUDE });
    if (!profil) return NextResponse.json({ error: "Aucun compte revendeur ouvert pour cet utilisateur" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const variante = (searchParams.get("variante") as VarianteRevendeur) || "CARTE";
    if (!VARIANTES.includes(variante)) return NextResponse.json({ error: "Variante invalide" }, { status: 400 });

    const stats = variante === "ATTESTATION" ? await statsAchatsRevendeur(userId) : undefined;

    const qrUrl = qrInstanceUrl(req, "REV", profil.id, profil.createdAt.toISOString());
    const qrDataUrl = await genererQrDataUrl(qrUrl);

    const html = genFicheRevendeurHtml(variante, profil, { stats, qrDataUrl });
    const pdf = await htmlToPdf(html);
    return pdfResponse(pdf, `${variante.toLowerCase()}-revendeur.pdf`);
  } catch (error) {
    console.error("GET /revendeur/profil/pdf:", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
