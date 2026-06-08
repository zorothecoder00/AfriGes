import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutProcedure } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

const INCLUDE = {
  profilRH: {
    select: {
      id: true, matricule: true,
      gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
    },
  },
};

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await params;
    const proc = await prisma.procedureDisciplinaire.findUnique({ where: { id: Number(id) }, include: INCLUDE });
    if (!proc) return NextResponse.json({ error: "Procédure introuvable" }, { status: 404 });
    return NextResponse.json({ data: proc });
  } catch (error) {
    console.error("GET /api/admin/rh/disciplinaire/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/rh/disciplinaire/[id]
 * Workflow: { action: "INSTRUIRE" | "CLOTURER" | "ANNULER" }
 * Édition:  { faitsReproches?, dateConvocation?, reponseCollab?, decision?, dateDecision?, dureeSuspension?, notes? }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id }  = await params;
    const body    = await req.json();
    const { action, ...editFields } = body;

    const proc = await prisma.procedureDisciplinaire.findUnique({ where: { id: Number(id) } });
    if (!proc) return NextResponse.json({ error: "Procédure introuvable" }, { status: 404 });

    if (action) {
      const TRANSITIONS: Record<string, { from: StatutProcedure[]; to: StatutProcedure }> = {
        INSTRUIRE: { from: ["OUVERTE"],                      to: "EN_INSTRUCTION" },
        CLOTURER:  { from: ["OUVERTE","EN_INSTRUCTION"],     to: "CLOTUREE"       },
        ANNULER:   { from: ["OUVERTE","EN_INSTRUCTION"],     to: "ANNULEE"        },
      };
      const t = TRANSITIONS[action];
      if (!t) return NextResponse.json({ error: "Action invalide" }, { status: 400 });
      if (!t.from.includes(proc.statut)) return NextResponse.json({ error: `Impossible depuis ${proc.statut}` }, { status: 422 });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = { statut: t.to };
      if (action === "CLOTURER" && editFields.decision) {
        data.decision    = editFields.decision;
        data.dateDecision= new Date();
      }

      const updated = await prisma.procedureDisciplinaire.update({ where: { id: Number(id) }, data, include: INCLUDE });
      await prisma.auditLog.create({ data: { userId: parseInt(session.user.id), action: "UPDATE", entite: "ProcedureDisciplinaire", entiteId: Number(id), details: `Procédure #${id} : ${proc.statut} → ${t.to}` } });
      return NextResponse.json({ data: updated });
    }

    // Édition champs
    const allowed = ["faitsReproches","dateConvocation","reponseCollab","decision","dateDecision","dureeSuspension","notes"];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    for (const key of allowed) {
      if (key in editFields) {
        if (key === "dateConvocation" || key === "dateDecision") data[key] = editFields[key] ? new Date(editFields[key]) : null;
        else if (key === "dureeSuspension") data[key] = editFields[key] ? Number(editFields[key]) : null;
        else data[key] = editFields[key] ?? null;
      }
    }

    const updated = await prisma.procedureDisciplinaire.update({ where: { id: Number(id) }, data, include: INCLUDE });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/disciplinaire/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
