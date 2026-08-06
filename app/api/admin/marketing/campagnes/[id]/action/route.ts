import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { appliquerActionCampagne, CampagneWorkflowError, type CampagneAction } from "@/lib/marketingCampagneWorkflow";

type Ctx = { params: Promise<{ id: string }> };

const ACTION_PERMISSION: Record<CampagneAction, "MODIFICATION" | "VALIDATION"> = {
  SOUMETTRE: "MODIFICATION",
  APPROUVER: "VALIDATION",
  REJETER: "VALIDATION",
  ACTIVER: "MODIFICATION",
  METTRE_EN_PAUSE: "MODIFICATION",
  REPRENDRE: "MODIFICATION",
  TERMINER: "MODIFICATION",
  ARCHIVER: "MODIFICATION",
};

/**
 * POST /api/admin/marketing/campagnes/[id]/action
 * Body: { action: CampagneAction, commentaire?: string }
 * Fait transiter le statut de la campagne (CDC §6 : BROUILLON→PLANIFIEE→
 * APPROUVEE→ACTIVE→PAUSE→TERMINEE→ARCHIVEE).
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const campagneId = Number(id);
    if (isNaN(campagneId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const action = body.action as CampagneAction | undefined;
    if (!action || !ACTION_PERMISSION[action]) {
      return NextResponse.json({ error: "Action invalide" }, { status: 400 });
    }

    const denied = await requirePermission(session, "marketing", ACTION_PERMISSION[action]);
    if (denied) return denied;

    const userId = Number(session.user.id);
    const result = await prisma.$transaction((tx) =>
      appliquerActionCampagne(tx, { campagneId, userId, action, commentaire: body.commentaire })
    );

    return NextResponse.json({ data: result });
  } catch (e: unknown) {
    if (e instanceof CampagneWorkflowError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("POST /api/admin/marketing/campagnes/[id]/action", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
