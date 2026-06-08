import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutPoste } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

const INCLUDE = {
  _count: { select: { candidatures: true } },
  candidatures: {
    orderBy: { createdAt: "desc" as const },
  },
};

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await params;
    const poste = await prisma.posteOuvert.findUnique({ where: { id: Number(id) }, include: INCLUDE });
    if (!poste) return NextResponse.json({ error: "Poste introuvable" }, { status: 404 });
    return NextResponse.json({ data: poste });
  } catch (error) {
    console.error("GET /api/admin/rh/recrutement/postes/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/rh/recrutement/postes/[id]
 * Workflow: { action: "DEMARRER" | "MARQUER_POURVU" | "ANNULER" }
 * Édition:  champs libres
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id }  = await params;
    const body    = await req.json();
    const { action, ...editFields } = body;

    const poste = await prisma.posteOuvert.findUnique({ where: { id: Number(id) } });
    if (!poste) return NextResponse.json({ error: "Poste introuvable" }, { status: 404 });

    if (action) {
      const TRANSITIONS: Record<string, { from: StatutPoste[]; to: StatutPoste }> = {
        DEMARRER:       { from: ["OUVERT"],              to: "EN_COURS" },
        MARQUER_POURVU: { from: ["OUVERT","EN_COURS"],   to: "POURVU"   },
        ANNULER:        { from: ["OUVERT","EN_COURS"],   to: "ANNULE"   },
        REUVRIR:        { from: ["ANNULE"],              to: "OUVERT"   },
      };
      const t = TRANSITIONS[action];
      if (!t) return NextResponse.json({ error: "Action invalide" }, { status: 400 });
      if (!t.from.includes(poste.statut)) return NextResponse.json({ error: `Impossible depuis ${poste.statut}` }, { status: 422 });

      const updated = await prisma.posteOuvert.update({ where: { id: Number(id) }, data: { statut: t.to }, include: INCLUDE });
      await prisma.auditLog.create({ data: { userId: parseInt(session.user.id), action: "UPDATE", entite: "PosteOuvert", entiteId: Number(id), details: `Poste #${id} : ${poste.statut} → ${t.to}` } });
      return NextResponse.json({ data: updated });
    }

    const allowed = ["titre","departement","service","typeContrat","description","competencesRequises","experienceMin","dateLimite","notes"];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    for (const key of allowed) {
      if (key in editFields) {
        if (key === "dateLimite") data[key] = editFields[key] ? new Date(editFields[key]) : null;
        else if (key === "experienceMin") data[key] = editFields[key] ? Number(editFields[key]) : null;
        else data[key] = editFields[key] ?? null;
      }
    }

    const updated = await prisma.posteOuvert.update({ where: { id: Number(id) }, data, include: INCLUDE });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/recrutement/postes/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
