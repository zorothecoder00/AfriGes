import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutIncident } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await params;
    const incident = await prisma.rapportIncident.findUnique({ where: { id: Number(id) } });
    if (!incident) return NextResponse.json({ error: "Incident introuvable" }, { status: 404 });
    return NextResponse.json({ data: incident });
  } catch (error) {
    console.error("GET /api/admin/rh/sst/incidents/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/rh/sst/incidents/[id]
 * Workflow: { action: "INSTRUIRE" | "CLOTURER" | "ANNULER" }
 * Édition:  { description?, personnesImpliquees?, gravite?, actionsCorrectives?, documentUrl?, notes? }
 * Registre légal — pas de suppression, uniquement correction/annulation.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id }  = await params;
    const body    = await req.json();
    const { action, ...editFields } = body;

    const incident = await prisma.rapportIncident.findUnique({ where: { id: Number(id) } });
    if (!incident) return NextResponse.json({ error: "Incident introuvable" }, { status: 404 });

    if (action) {
      const TRANSITIONS: Record<string, { from: StatutIncident[]; to: StatutIncident }> = {
        INSTRUIRE: { from: ["OUVERT"],                 to: "EN_COURS" },
        CLOTURER:  { from: ["OUVERT", "EN_COURS"],     to: "CLOTURE"  },
        ANNULER:   { from: ["OUVERT", "EN_COURS"],     to: "ANNULE"   },
      };
      const t = TRANSITIONS[action];
      if (!t) return NextResponse.json({ error: "Action invalide" }, { status: 400 });
      if (!t.from.includes(incident.statut)) return NextResponse.json({ error: `Impossible depuis ${incident.statut}` }, { status: 422 });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = { statut: t.to };
      if (action === "CLOTURER" && editFields.actionsCorrectives) {
        data.actionsCorrectives = editFields.actionsCorrectives;
      }

      const updated = await prisma.rapportIncident.update({ where: { id: Number(id) }, data });
      await prisma.auditLog.create({
        data: { userId: parseInt(session.user.id), action: "UPDATE", entite: "RapportIncident", entiteId: Number(id),
          details: `Incident #${id} : ${incident.statut} → ${t.to}` },
      });
      return NextResponse.json({ data: updated });
    }

    const allowed = ["description", "personnesImpliquees", "gravite", "actionsCorrectives", "documentUrl", "notes"];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    for (const key of allowed) {
      if (key in editFields) data[key] = editFields[key] ?? null;
    }

    const updated = await prisma.rapportIncident.update({ where: { id: Number(id) }, data });
    await prisma.auditLog.create({
      data: { userId: parseInt(session.user.id), action: "UPDATE", entite: "RapportIncident", entiteId: Number(id), details: `Incident #${id} modifié` },
    });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/sst/incidents/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
