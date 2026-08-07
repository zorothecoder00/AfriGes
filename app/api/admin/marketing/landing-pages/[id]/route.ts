import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/marketing/landing-pages/[id] — détail + soumissions. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const { id } = await params;
    const pageId = Number(id);
    if (isNaN(pageId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const page = await prisma.landingPageMarketing.findUnique({
      where: { id: pageId },
      include: {
        campagne: { select: { id: true, code: true, nom: true } },
        produit: { select: { id: true, nom: true } },
        formulaire: { select: { id: true, nom: true, champs: true } },
        qrCodes: { select: { id: true, code: true, nbScans: true } },
        soumissions: {
          orderBy: { createdAt: "desc" },
          select: { id: true, createdAt: true, clientCree: { select: { id: true, nom: true, prenom: true } } },
        },
      },
    });
    if (!page) return NextResponse.json({ error: "Landing page introuvable" }, { status: 404 });

    return NextResponse.json({ data: page });
  } catch (e) {
    console.error("GET /api/admin/marketing/landing-pages/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** PATCH /api/admin/marketing/landing-pages/[id] — édition. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "MODIFICATION");
    if (denied) return denied;

    const { id } = await params;
    const pageId = Number(id);
    if (isNaN(pageId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { titre, description, offreTexte, imageUrl, ctaLabel, ctaUrl, formulaireId, actif } = body;
    const userId = Number(session.user.id);

    const page = await prisma.$transaction(async (tx) => {
      const updated = await tx.landingPageMarketing.update({
        where: { id: pageId },
        data: {
          ...(titre !== undefined ? { titre } : {}),
          ...(description !== undefined ? { description: description || null } : {}),
          ...(offreTexte !== undefined ? { offreTexte: offreTexte || null } : {}),
          ...(imageUrl !== undefined ? { imageUrl: imageUrl || null } : {}),
          ...(ctaLabel !== undefined ? { ctaLabel: ctaLabel || null } : {}),
          ...(ctaUrl !== undefined ? { ctaUrl: ctaUrl || null } : {}),
          ...(formulaireId !== undefined ? { formulaireId: formulaireId ? Number(formulaireId) : null } : {}),
          ...(actif !== undefined ? { actif: Boolean(actif) } : {}),
        },
      });
      await auditLog(tx, userId, "UPDATE", "LandingPageMarketing", pageId, { actif });
      return updated;
    });

    return NextResponse.json({ data: page });
  } catch (e) {
    console.error("PATCH /api/admin/marketing/landing-pages/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
