import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession, estDirection } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { appliquerActionPublication, PublicationWorkflowError, type PublicationAction } from "@/lib/publicationSocialeWorkflow";

type Ctx = { params: Promise<{ id: string }> };

const ACTION_PERMISSION: Record<PublicationAction, "MODIFICATION" | "VALIDATION"> = {
  SOUMETTRE:          "MODIFICATION",
  VALIDER:            "VALIDATION",
  VALIDER_DIRECTION:  "VALIDATION",
  REJETER:            "VALIDATION",
  PROGRAMMER:         "MODIFICATION",
  PUBLIER:            "MODIFICATION",
};

/**
 * POST /api/admin/marketing/publications/[id]/action
 * Body: { action: PublicationAction }
 * Workflow CDC §30-31 : IDEE→BROUILLON→EN_REVISION→VALIDE→PROGRAMME→PUBLIE.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const publicationId = Number(id);
    if (isNaN(publicationId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const action = body.action as PublicationAction | undefined;
    if (!action || !ACTION_PERMISSION[action]) {
      return NextResponse.json({ error: "Action invalide" }, { status: 400 });
    }

    const denied = await requirePermission(session, "marketing", ACTION_PERMISSION[action]);
    if (denied) return denied;

    // CDC §31 — le 2e palier (Direction) est réservé à Admin/Super Admin, même si
    // un autre rôle a la permission "VALIDATION" marketing (ex. Responsable Marketing).
    if (action === "VALIDER_DIRECTION" && !estDirection(session)) {
      return NextResponse.json({ error: "Réservé à la Direction (Admin/Super Admin)" }, { status: 403 });
    }

    const userId = Number(session.user.id);
    const result = await prisma.$transaction((tx) =>
      appliquerActionPublication(tx, { publicationId, userId, action })
    );

    return NextResponse.json({ data: result });
  } catch (e: unknown) {
    if (e instanceof PublicationWorkflowError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("POST /api/admin/marketing/publications/[id]/action", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
