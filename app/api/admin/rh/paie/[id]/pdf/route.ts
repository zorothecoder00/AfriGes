import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession, profilRHDansPerimetre } from "@/lib/authRH";
import { requirePermission } from "@/lib/permissions";
import { htmlToPdf, pdfResponse } from "@/lib/pdf";
import { genBulletinHtml, type BulletinData } from "@/lib/bulletinHtml";

// Chromium nécessite le runtime Node (pas Edge) ; génération potentiellement longue.
export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/rh/paie/[id]/pdf
 * Bulletin de paie en PDF (streaming, généré côté serveur via Chromium).
 * Accessible aux ADMIN/SUPER_ADMIN et RESPONSABLE_RH.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "paie", "EXPORT");
    if (denied) return denied;

    const { id } = await params;
    const fiche = await prisma.fichePaie.findUnique({
      where: { id: Number(id) },
      include: {
        composants: true,
        profilRH: {
          select: {
            matricule: true, fonction: true, departement: true, dateEmbauche: true,
            gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
          },
        },
      },
    });
    if (!fiche) return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });

    // Scoping PDV : un RESPONSABLE_RH ne peut voir que les fiches de son périmètre.
    if (!(await profilRHDansPerimetre(session, fiche.profilRHId))) {
      return NextResponse.json({ error: "Fiche hors de votre périmètre" }, { status: 403 });
    }

    const html     = genBulletinHtml(fiche as unknown as BulletinData);
    const pdf      = await htmlToPdf(html);
    const filename = `bulletin-${fiche.profilRH.matricule}-${fiche.mois}-${fiche.annee}.pdf`;
    return pdfResponse(pdf, filename);
  } catch (error) {
    console.error("GET /api/admin/rh/paie/[id]/pdf", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
