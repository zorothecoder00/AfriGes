import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/marketing/formulaires/[id] — détail + soumissions. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const { id } = await params;
    const formulaireId = Number(id);
    if (isNaN(formulaireId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const formulaire = await prisma.formulaireMarketing.findUnique({
      where: { id: formulaireId },
      include: {
        soumissions: {
          orderBy: { createdAt: "desc" },
          select: { id: true, donnees: true, canal: true, createdAt: true, clientCree: { select: { id: true, nom: true, prenom: true } } },
        },
      },
    });
    if (!formulaire) return NextResponse.json({ error: "Formulaire introuvable" }, { status: 404 });

    return NextResponse.json({ data: formulaire });
  } catch (e) {
    console.error("GET /api/admin/marketing/formulaires/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** PATCH /api/admin/marketing/formulaires/[id] — actif surtout (nom éditable aussi). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "MODIFICATION");
    if (denied) return denied;

    const { id } = await params;
    const formulaireId = Number(id);
    if (isNaN(formulaireId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { nom, actif } = body;
    const userId = Number(session.user.id);

    const formulaire = await prisma.$transaction(async (tx) => {
      const updated = await tx.formulaireMarketing.update({
        where: { id: formulaireId },
        data: {
          ...(nom !== undefined ? { nom } : {}),
          ...(actif !== undefined ? { actif: Boolean(actif) } : {}),
        },
      });
      await auditLog(tx, userId, "UPDATE", "FormulaireMarketing", formulaireId, { actif });
      return updated;
    });

    return NextResponse.json({ data: formulaire });
  } catch (e) {
    console.error("PATCH /api/admin/marketing/formulaires/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
