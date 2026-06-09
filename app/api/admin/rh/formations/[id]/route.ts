import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutFormation, StatutParticipationFormation } from "@prisma/client";
import { notifyInscriptionFormation } from "@/lib/notificationsRH";

type Ctx = { params: Promise<{ id: string }> };

const INCLUDE = {
  participations: {
    include: {
      profilRH: {
        select: {
          id: true, matricule: true,
          gestionnaire: { select: { member: { select: { id: true, nom: true, prenom: true, photo: true } } } },
        },
      },
    },
  },
  _count: { select: { participations: true } },
};

/**
 * GET /api/admin/rh/formations/[id]
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await params;
    const formation = await prisma.formation.findUnique({ where: { id: Number(id) }, include: INCLUDE });
    if (!formation) return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
    return NextResponse.json({ data: formation });
  } catch (error) {
    console.error("GET /api/admin/rh/formations/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/rh/formations/[id]
 * Workflow: { action: "DEMARRER" | "TERMINER" | "ANNULER" }
 * Édition:  { titre?, objectifs?, lieu?, formateur?, dateDebut?, dateFin?, dureeHeures?, cout?, notes? }
 * Participants: { addParticipants?: number[], removeParticipants?: number[] }
 * Statut participation: { participantId, statutParticipation, note?, certificatUrl? }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body   = await req.json();
    const {
      action,
      addParticipants, removeParticipants,
      participantId, statutParticipation, note, certificatUrl,
      ...editFields
    } = body;

    const formation = await prisma.formation.findUnique({ where: { id: Number(id) } });
    if (!formation) return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });

    // ── Workflow ──────────────────────────────────────────────────────────────
    if (action) {
      const TRANSITIONS: Record<string, { from: StatutFormation[]; to: StatutFormation }> = {
        DEMARRER: { from: ["PLANIFIEE"],              to: "EN_COURS" },
        TERMINER: { from: ["EN_COURS", "PLANIFIEE"],  to: "TERMINEE" },
        ANNULER:  { from: ["PLANIFIEE", "EN_COURS"],  to: "ANNULEE"  },
      };
      const t = TRANSITIONS[action];
      if (!t) return NextResponse.json({ error: "Action invalide" }, { status: 400 });
      if (!t.from.includes(formation.statut)) return NextResponse.json({ error: `Impossible depuis ${formation.statut}` }, { status: 422 });

      const updated = await prisma.formation.update({ where: { id: Number(id) }, data: { statut: t.to }, include: INCLUDE });
      await prisma.auditLog.create({ data: { userId: parseInt(session.user.id), action: "UPDATE", entite: "Formation", entiteId: Number(id), details: { avant: { statut: formation.statut }, apres: { statut: t.to } } } });
      return NextResponse.json({ data: updated });
    }

    // ── Mise à jour statut d'un participant ───────────────────────────────────
    if (participantId !== undefined && statutParticipation) {
      const participation = await prisma.participationFormation.findUnique({
        where: { formationId_profilRHId: { formationId: Number(id), profilRHId: Number(participantId) } },
      });
      if (!participation) return NextResponse.json({ error: "Participant introuvable" }, { status: 404 });

      const updated = await prisma.participationFormation.update({
        where: { formationId_profilRHId: { formationId: Number(id), profilRHId: Number(participantId) } },
        data: {
          statut:       statutParticipation as StatutParticipationFormation,
          note:         note         !== undefined ? (note ?? null)         : undefined,
          certificatUrl:certificatUrl!== undefined ? (certificatUrl ?? null): undefined,
        },
      });
      return NextResponse.json({ data: updated });
    }

    // ── Ajout / suppression de participants ───────────────────────────────────
    if (addParticipants || removeParticipants) {
      await prisma.$transaction(async (tx) => {
        if (addParticipants?.length) {
          await tx.participationFormation.createMany({
            data: addParticipants.map((pid: number) => ({ formationId: Number(id), profilRHId: pid, statut: "INSCRIT" as StatutParticipationFormation })),
            skipDuplicates: true,
          });
        }
        if (removeParticipants?.length) {
          await tx.participationFormation.deleteMany({
            where: { formationId: Number(id), profilRHId: { in: removeParticipants } },
          });
        }
      });
      const updated = await prisma.formation.findUnique({ where: { id: Number(id) }, include: INCLUDE });
      // Notifier les nouveaux participants (non-bloquant)
      if (addParticipants?.length) {
        for (const pid of addParticipants) {
          notifyInscriptionFormation(Number(id), pid).catch(() => {});
        }
      }
      return NextResponse.json({ data: updated });
    }

    // ── Édition champs ────────────────────────────────────────────────────────
    const allowed = ["titre", "type", "objectifs", "lieu", "formateur", "dateDebut", "dateFin", "dureeHeures", "cout", "budgetAlloue", "certificationNom", "notes"];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    for (const key of allowed) {
      if (key in editFields) {
        if (key === "dateDebut" || key === "dateFin") updateData[key] = editFields[key] ? new Date(editFields[key]) : null;
        else if (["dureeHeures", "cout", "budgetAlloue"].includes(key)) updateData[key] = editFields[key] ? Number(editFields[key]) : null;
        else updateData[key] = editFields[key] ?? null;
      }
    }
    if (Object.keys(updateData).length === 0) return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });

    const updated = await prisma.formation.update({ where: { id: Number(id) }, data: updateData, include: INCLUDE });
    await prisma.auditLog.create({ data: { userId: parseInt(session.user.id), action: "UPDATE", entite: "Formation", entiteId: Number(id), details: { avant: Object.fromEntries(Object.keys(updateData).map((k) => [k, (formation as Record<string, unknown>)[k] ?? null])), apres: updateData } } });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/formations/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
