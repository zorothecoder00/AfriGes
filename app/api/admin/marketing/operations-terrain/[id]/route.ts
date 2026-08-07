import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/marketing/operations-terrain/[id] — détail complet. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const { id } = await params;
    const operationId = Number(id);
    if (isNaN(operationId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const operation = await prisma.operationTerrain.findUnique({
      where: { id: operationId },
      include: {
        campagne: { select: { id: true, code: true, nom: true } },
        pointDeVente: { select: { id: true, nom: true } },
        equipe: { select: { agent: { select: { id: true, nom: true, prenom: true } } } },
        soumissions: { select: { id: true, createdAt: true, clientCree: { select: { id: true, nom: true, prenom: true } } } },
      },
    });
    if (!operation) return NextResponse.json({ error: "Opération introuvable" }, { status: 404 });

    return NextResponse.json({ data: { ...operation, budget: Number(operation.budget), ventesGenereesCA: Number(operation.ventesGenereesCA) } });
  } catch (e) {
    console.error("GET /api/admin/marketing/operations-terrain/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/marketing/operations-terrain/[id]
 * Édition du statut et saisie des résultats en fin d'opération (CDC §41).
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "MODIFICATION");
    if (denied) return denied;

    const { id } = await params;
    const operationId = Number(id);
    if (isNaN(operationId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { statut, prospectsGeneres, clientsConvertis, ventesGenereesCA, resultatsNotes } = body;
    const userId = Number(session.user.id);

    const operation = await prisma.$transaction(async (tx) => {
      const updated = await tx.operationTerrain.update({
        where: { id: operationId },
        data: {
          ...(statut !== undefined ? { statut } : {}),
          ...(prospectsGeneres !== undefined ? { prospectsGeneres: Number(prospectsGeneres) } : {}),
          ...(clientsConvertis !== undefined ? { clientsConvertis: Number(clientsConvertis) } : {}),
          ...(ventesGenereesCA !== undefined ? { ventesGenereesCA: Number(ventesGenereesCA) } : {}),
          ...(resultatsNotes !== undefined ? { resultatsNotes: resultatsNotes || null } : {}),
        },
      });
      await auditLog(tx, userId, "UPDATE", "OperationTerrain", operationId, { statut });
      return updated;
    });

    return NextResponse.json({ data: { ...operation, budget: Number(operation.budget), ventesGenereesCA: Number(operation.ventesGenereesCA) } });
  } catch (e) {
    console.error("PATCH /api/admin/marketing/operations-terrain/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
