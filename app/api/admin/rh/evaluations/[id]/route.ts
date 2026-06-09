import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutEvaluationRH } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

const INCLUDE = {
  criteres:  true,
  objectifs: true,
  profilRH: {
    select: {
      id: true, matricule: true,
      gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
    },
  },
  evaluateur: {
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
    const eval_ = await prisma.evaluationRH.findUnique({ where: { id: Number(id) }, include: INCLUDE });
    if (!eval_) return NextResponse.json({ error: "Évaluation introuvable" }, { status: 404 });
    return NextResponse.json({ data: eval_ });
  } catch (error) {
    console.error("GET /api/admin/rh/evaluations/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/rh/evaluations/[id]
 * Workflow: { action: "FIXER_OBJECTIFS" | "DEMARRER" | "EVALUER" | "SOUMETTRE_VALIDATION" | "VALIDER" | "PLAN" | "CLOTURER" | "REUVRIR" }
 * Édition:  tous les champs + criteres (remplace les existants)
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id }  = await params;
    const body    = await req.json();
    const { action, criteres, ...editFields } = body;

    const eval_ = await prisma.evaluationRH.findUnique({ where: { id: Number(id) } });
    if (!eval_) return NextResponse.json({ error: "Évaluation introuvable" }, { status: 404 });

    // ── Workflow ──────────────────────────────────────────────────────────────
    if (action) {
      const TRANSITIONS: Record<string, { from: StatutEvaluationRH[]; to: StatutEvaluationRH }> = {
        FIXER_OBJECTIFS:      { from: ["BROUILLON"],                                                                  to: "OBJECTIFS_FIXES"   },
        DEMARRER:             { from: ["BROUILLON", "OBJECTIFS_FIXES"],                                               to: "EN_COURS"          },
        EVALUER:              { from: ["EN_COURS"],                                                                   to: "EVALUATION"        },
        SOUMETTRE_VALIDATION: { from: ["EVALUATION"],                                                                 to: "VALIDATION"        },
        VALIDER:              { from: ["VALIDATION"],                                                                 to: "PLAN_AMELIORATION" },
        CLOTURER:             { from: ["BROUILLON","OBJECTIFS_FIXES","EN_COURS","EVALUATION","VALIDATION","PLAN_AMELIORATION"], to: "CLOTURE" },
        REUVRIR:              { from: ["CLOTURE"],                                                                    to: "EN_COURS"          },
      };

      const t = TRANSITIONS[action];
      if (!t) return NextResponse.json({ error: "Action invalide" }, { status: 400 });
      if (!t.from.includes(eval_.statut))
        return NextResponse.json({ error: `Impossible depuis le statut ${eval_.statut}` }, { status: 422 });

      const updated = await prisma.evaluationRH.update({
        where: { id: Number(id) },
        data:  { statut: t.to, ...(t.to === "CLOTURE" && !eval_.dateFin ? { dateFin: new Date() } : {}) },
        include: INCLUDE,
      });
      await prisma.auditLog.create({
        data: { userId: parseInt(session.user.id), action: "UPDATE", entite: "EvaluationRH", entiteId: Number(id),
          details: `Évaluation #${id} : ${eval_.statut} → ${t.to}` },
      });
      return NextResponse.json({ data: updated });
    }

    // ── Mise à jour champs + critères ─────────────────────────────────────────
    const allowed = [
      "evaluateurId","typeEvaluation","dateDebut","dateFin",
      "noteGlobale","appreciation","pointsForts","axesAmelioration",
      "objectifsN1","planAmelioration","notes",
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    for (const key of allowed) {
      if (key in editFields) {
        if (key === "dateDebut" || key === "dateFin")
          data[key] = editFields[key] ? new Date(editFields[key]) : null;
        else if (key === "noteGlobale")
          data[key] = editFields[key] !== null ? Number(editFields[key]) : null;
        else if (key === "evaluateurId")
          data[key] = editFields[key] ? Number(editFields[key]) : null;
        else
          data[key] = editFields[key] ?? null;
      }
    }

    let updated;
    if (criteres !== undefined) {
      updated = await prisma.$transaction(async (tx) => {
        await tx.critereEvaluation.deleteMany({ where: { evaluationId: Number(id) } });
        return tx.evaluationRH.update({
          where: { id: Number(id) },
          data: {
            ...data,
            criteres: criteres.length > 0 ? {
              create: criteres.map((c: { libelle: string; note: number; commentaire?: string }) => ({
                libelle: c.libelle, note: Number(c.note), commentaire: c.commentaire ?? null,
              })),
            } : undefined,
          },
          include: INCLUDE,
        });
      });
    } else {
      updated = await prisma.evaluationRH.update({ where: { id: Number(id) }, data, include: INCLUDE });
    }

    await prisma.auditLog.create({
      data: { userId: parseInt(session.user.id), action: "UPDATE", entite: "EvaluationRH", entiteId: Number(id), details: `Évaluation #${id} modifiée` },
    });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/evaluations/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
