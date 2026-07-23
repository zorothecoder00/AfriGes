import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutAccidentTravail } from "@prisma/client";

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
    const accident = await prisma.accidentTravail.findUnique({ where: { id: Number(id) }, include: INCLUDE });
    if (!accident) return NextResponse.json({ error: "Accident introuvable" }, { status: 404 });
    return NextResponse.json({ data: accident });
  } catch (error) {
    console.error("GET /api/admin/rh/sst/accidents/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/rh/sst/accidents/[id]
 * Workflow: { action: "INSTRUIRE" | "CLOTURER" | "ANNULER" }
 * Édition:  { natureLesion?, arretTravail?, dureeArretJours?, mesuresCorrectives?, documentUrl?, notes? }
 * Registre légal — pas de suppression, uniquement correction/annulation.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id }  = await params;
    const body    = await req.json();
    const { action, ...editFields } = body;

    const accident = await prisma.accidentTravail.findUnique({ where: { id: Number(id) } });
    if (!accident) return NextResponse.json({ error: "Accident introuvable" }, { status: 404 });

    if (action) {
      const TRANSITIONS: Record<string, { from: StatutAccidentTravail[]; to: StatutAccidentTravail }> = {
        INSTRUIRE: { from: ["DECLARE"],                    to: "EN_INSTRUCTION" },
        CLOTURER:  { from: ["DECLARE", "EN_INSTRUCTION"],  to: "CLOTURE"        },
        ANNULER:   { from: ["DECLARE", "EN_INSTRUCTION"],  to: "ANNULE"         },
      };
      const t = TRANSITIONS[action];
      if (!t) return NextResponse.json({ error: "Action invalide" }, { status: 400 });
      if (!t.from.includes(accident.statut)) return NextResponse.json({ error: `Impossible depuis ${accident.statut}` }, { status: 422 });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = { statut: t.to };
      if (action === "CLOTURER" && editFields.mesuresCorrectives) {
        data.mesuresCorrectives = editFields.mesuresCorrectives;
      }

      const updated = await prisma.accidentTravail.update({ where: { id: Number(id) }, data, include: INCLUDE });
      await prisma.auditLog.create({
        data: { userId: parseInt(session.user.id), action: "UPDATE", entite: "AccidentTravail", entiteId: Number(id),
          details: `Accident #${id} : ${accident.statut} → ${t.to}` },
      });
      return NextResponse.json({ data: updated });
    }

    const allowed = ["natureLesion", "arretTravail", "dureeArretJours", "mesuresCorrectives", "documentUrl", "notes"];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    for (const key of allowed) {
      if (key in editFields) {
        if (key === "arretTravail") data[key] = Boolean(editFields[key]);
        else if (key === "dureeArretJours") data[key] = editFields[key] ? Number(editFields[key]) : null;
        else data[key] = editFields[key] ?? null;
      }
    }

    const updated = await prisma.accidentTravail.update({ where: { id: Number(id) }, data, include: INCLUDE });
    await prisma.auditLog.create({
      data: { userId: parseInt(session.user.id), action: "UPDATE", entite: "AccidentTravail", entiteId: Number(id), details: `Accident #${id} modifié` },
    });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/sst/accidents/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
