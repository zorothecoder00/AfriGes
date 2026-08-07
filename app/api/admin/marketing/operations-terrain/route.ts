import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";
import { validerOperationTerrain } from "@/lib/operationTerrain";

/**
 * Opérations marketing terrain (CDC §41).
 * GET  — liste des opérations (avec équipe + campagne).
 * POST — crée une opération (zone, équipe, budget, période).
 */
export async function GET() {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const operations = await prisma.operationTerrain.findMany({
      orderBy: { dateDebut: "desc" },
      include: {
        campagne: { select: { id: true, code: true, nom: true } },
        pointDeVente: { select: { id: true, nom: true } },
        equipe: { select: { agent: { select: { id: true, nom: true, prenom: true } } } },
        _count: { select: { soumissions: true } },
      },
    });

    return NextResponse.json({ data: operations.map((o) => ({ ...o, budget: Number(o.budget), ventesGenereesCA: Number(o.ventesGenereesCA) })) });
  } catch (e) {
    console.error("GET /api/admin/marketing/operations-terrain", e);
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
    const valid = await validerOperationTerrain(body);
    if ("error" in valid) return NextResponse.json({ error: valid.error }, { status: valid.status });

    const userId = Number(session.user.id);
    const operation = await prisma.$transaction(async (tx) => {
      const o = await tx.operationTerrain.create({
        data: {
          campagneId: valid.data.campagneId, type: valid.data.type, zone: valid.data.zone,
          pointDeVenteId: valid.data.pointDeVenteId, dateDebut: valid.data.dateDebut, dateFin: valid.data.dateFin,
          budget: valid.data.budget, objectifsText: valid.data.objectifsText, creeParId: userId,
          equipe: { create: valid.data.equipeIds.map((agentId) => ({ agentId })) },
        },
        include: { equipe: { select: { agent: { select: { id: true, nom: true, prenom: true } } } } },
      });
      await auditLog(tx, userId, "OPERATION_TERRAIN_CREEE", "OperationTerrain", o.id);
      return o;
    });

    return NextResponse.json({ data: { ...operation, budget: Number(operation.budget), ventesGenereesCA: Number(operation.ventesGenereesCA) } }, { status: 201 });
  } catch (e) {
    console.error("POST /api/admin/marketing/operations-terrain", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
