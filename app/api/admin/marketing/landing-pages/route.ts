import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";
import { genererSlugLandingPage } from "@/lib/landingPage";

/**
 * Landing pages marketing (CDC §44).
 * GET  — liste des landing pages.
 * POST — crée une landing page (titre/offre/CTA/formulaire).
 */
export async function GET() {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const pages = await prisma.landingPageMarketing.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        campagne: { select: { id: true, code: true, nom: true } },
        produit: { select: { id: true, nom: true } },
        formulaire: { select: { id: true, nom: true } },
        _count: { select: { soumissions: true } },
      },
    });

    return NextResponse.json({ data: pages });
  } catch (e) {
    console.error("GET /api/admin/marketing/landing-pages", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "CREATION");
    if (denied) return denied;

    const body = await req.json();
    const { campagneId, titre, description, produitId, offreTexte, imageUrl, ctaLabel, ctaUrl, formulaireId, actif } = body;

    const titreTrim = typeof titre === "string" ? titre.trim() : "";
    if (!titreTrim) return NextResponse.json({ error: "Le titre est requis" }, { status: 400 });

    const userId = Number(session.user.id);
    const slug = await genererSlugLandingPage(titreTrim);

    const page = await prisma.$transaction(async (tx) => {
      const p = await tx.landingPageMarketing.create({
        data: {
          slug, titre: titreTrim, description: description || null,
          campagneId: campagneId ? Number(campagneId) : null,
          produitId: produitId ? Number(produitId) : null,
          offreTexte: offreTexte || null, imageUrl: imageUrl || null,
          ctaLabel: ctaLabel || null, ctaUrl: ctaUrl || null,
          formulaireId: formulaireId ? Number(formulaireId) : null,
          actif: actif === undefined ? true : Boolean(actif),
          creeParId: userId,
        },
      });
      await auditLog(tx, userId, "LANDING_PAGE_CREEE", "LandingPageMarketing", p.id);
      return p;
    });

    return NextResponse.json({ data: page }, { status: 201 });
  } catch (e) {
    console.error("POST /api/admin/marketing/landing-pages", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
