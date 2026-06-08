import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutMission } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

const INCLUDE = {
  collaborateur: {
    select: {
      id: true, matricule: true,
      gestionnaire: { select: { member: { select: { id: true, nom: true, prenom: true, photo: true } } } },
    },
  },
  validePar: {
    select: {
      id: true, matricule: true,
      gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
    },
  },
};

/**
 * GET /api/admin/rh/missions/[id]
 * Détail d'une mission
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const mission = await prisma.mission.findUnique({
      where: { id: Number(id) },
      include: INCLUDE,
    });
    if (!mission) return NextResponse.json({ error: "Mission introuvable" }, { status: 404 });

    return NextResponse.json({ data: mission });
  } catch (error) {
    console.error("GET /api/admin/rh/missions/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/rh/missions/[id]
 * Met à jour ou fait avancer le workflow d'une mission
 *
 * Body (workflow): { action: "VALIDER" | "DEMARRER" | "CLOTURER" | "ANNULER", rapport?, dateRetourReel?, notes? }
 * Body (édition):  { titre?, objectifs?, livrables?, destination?, dateDepart?, dateRetour?, notes? }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { action, rapport, dateRetourReel, ...editFields } = body;

    const mission = await prisma.mission.findUnique({ where: { id: Number(id) } });
    if (!mission) return NextResponse.json({ error: "Mission introuvable" }, { status: 404 });

    // ── Workflow ──────────────────────────────────────────────────────────────
    if (action) {
      const TRANSITIONS: Record<string, { from: StatutMission[]; to: StatutMission }> = {
        VALIDER:  { from: ["CREE"],              to: "VALIDE"   },
        DEMARRER: { from: ["VALIDE"],             to: "EN_COURS" },
        CLOTURER: { from: ["EN_COURS", "VALIDE"], to: "CLOTURE"  },
        ANNULER:  { from: ["CREE", "VALIDE"],     to: "ANNULE"   },
      };

      const transition = TRANSITIONS[action];
      if (!transition) return NextResponse.json({ error: "Action invalide" }, { status: 400 });
      if (!transition.from.includes(mission.statut)) {
        return NextResponse.json(
          { error: `Impossible de passer de ${mission.statut} avec l'action ${action}` },
          { status: 422 }
        );
      }

      // Trouver le profilRH de l'admin pour valideParId
      const adminProfil = await prisma.profilRH.findFirst({
        where: { gestionnaire: { memberId: parseInt(session.user.id) } },
        select: { id: true },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = { statut: transition.to };
      if (action === "VALIDER")  updateData.valideParId = adminProfil?.id ?? null;
      if (action === "CLOTURER") {
        if (rapport)        updateData.rapport        = rapport;
        if (dateRetourReel) updateData.dateRetourReel = new Date(dateRetourReel);
      }

      const updated = await prisma.mission.update({
        where: { id: Number(id) },
        data: updateData,
        include: INCLUDE,
      });

      await prisma.auditLog.create({
        data: {
          userId:   parseInt(session.user.id),
          action:   "UPDATE",
          entite:   "Mission",
          entiteId: updated.id,
          details:  `Mission #${id} : ${mission.statut} → ${transition.to}`,
        },
      });

      return NextResponse.json({ data: updated });
    }

    // ── Édition des champs ────────────────────────────────────────────────────
    const allowed = ["titre", "objectifs", "livrables", "destination", "dateDepart", "dateRetour", "notes", "rapport"];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    for (const key of allowed) {
      if (key in editFields) {
        if (key === "dateDepart" || key === "dateRetour") {
          updateData[key] = editFields[key] ? new Date(editFields[key]) : null;
        } else {
          updateData[key] = editFields[key] ?? null;
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
    }

    const updated = await prisma.mission.update({
      where: { id: Number(id) },
      data: updateData,
      include: INCLUDE,
    });

    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "UPDATE",
        entite:   "Mission",
        entiteId: updated.id,
        details:  `Mission #${id} modifiée`,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/missions/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
