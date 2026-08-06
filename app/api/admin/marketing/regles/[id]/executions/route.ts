import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/marketing/regles/[id]/executions
 * Suivi des clients inscrits dans une règle + leurs logs d'exécution (debug §16-17).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const { id } = await params;
    const regleId = Number(id);
    if (isNaN(regleId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const executions = await prisma.executionAutomatisation.findMany({
      where: { regleId },
      include: {
        client: { select: { id: true, nom: true, prenom: true, telephone: true } },
        logs: { orderBy: { dateExecution: "desc" }, include: { etape: { select: { ordre: true, action: true } } } },
      },
      orderBy: { dateInscription: "desc" },
      take: 200,
    });

    return NextResponse.json({ data: executions });
  } catch (e) {
    console.error("GET /api/admin/marketing/regles/[id]/executions", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
