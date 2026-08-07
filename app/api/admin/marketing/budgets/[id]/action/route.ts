import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { notifyRoles, auditLog } from "@/lib/notifications";
import { estDirection } from "@/lib/authMarketing";
import type { StatutBudgetMarketing } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };
type BudgetAction = "DEMANDER" | "VALIDER_RESPONSABLE" | "APPROUVER" | "REJETER";

const TRANSITIONS: Record<BudgetAction, StatutBudgetMarketing> = {
  DEMANDER:            "DEMANDE",
  VALIDER_RESPONSABLE: "EN_VALIDATION_DIRECTION",
  APPROUVER:           "APPROUVE",
  REJETER:             "REJETE",
};
const PRECONDITIONS: Record<BudgetAction, StatutBudgetMarketing[]> = {
  DEMANDER:            ["BROUILLON", "REJETE"],
  VALIDER_RESPONSABLE: ["DEMANDE"],
  APPROUVER:           ["EN_VALIDATION_DIRECTION"],
  REJETER:             ["DEMANDE", "EN_VALIDATION_DIRECTION"],
};

/**
 * POST /api/admin/marketing/budgets/[id]/action
 * Workflow budget à 2 paliers (CDC §54) : Marketing demande → Responsable
 * Marketing valide → Direction approuve → dépense possible.
 * Body: { action: "DEMANDER"|"VALIDER_RESPONSABLE"|"APPROUVER"|"REJETER", montantApprouve? }
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const budgetId = Number(id);
    if (isNaN(budgetId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const action = body.action as BudgetAction | undefined;
    if (!action || !TRANSITIONS[action]) return NextResponse.json({ error: "Action invalide" }, { status: 400 });

    const permission = action === "VALIDER_RESPONSABLE" || action === "APPROUVER" || action === "REJETER" ? "VALIDATION" : "MODIFICATION";
    const denied = await requirePermission(session, "marketing", permission);
    if (denied) return denied;

    // CDC §54 — le 2e palier (Direction) est réservé à Admin/Super Admin, même
    // si un autre rôle possède la permission "VALIDATION" marketing.
    if (action === "APPROUVER" && !estDirection(session)) {
      return NextResponse.json({ error: "Réservé à la Direction (Admin/Super Admin)" }, { status: 403 });
    }

    const userId = Number(session.user.id);
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.budgetMarketing.findUnique({ where: { id: budgetId }, include: { campagne: true } });
      if (!current) throw new Error("BUDGET_INTROUVABLE");
      if (!PRECONDITIONS[action].includes(current.statut)) {
        throw new Error(`TRANSITION_INVALIDE:Action « ${action} » impossible depuis le statut « ${current.statut} »`);
      }

      const data: Record<string, unknown> = { statut: TRANSITIONS[action] };
      if (action === "DEMANDER") data.demandeParId = userId;
      if (action === "VALIDER_RESPONSABLE") {
        data.valideParResponsableId = userId;
        data.dateValidationResponsable = new Date();
      }
      if (action === "APPROUVER") {
        data.approuveParId = userId;
        data.dateApprobation = new Date();
        data.montantApprouve = body.montantApprouve !== undefined
          ? Number(body.montantApprouve)
          : current.montantPrevu;
      }

      const updated = await tx.budgetMarketing.update({ where: { id: budgetId }, data });
      await auditLog(tx, userId, `ACTION_BUDGET:${action}`, "BudgetMarketing", budgetId, {
        avant: { statut: current.statut }, apres: { statut: updated.statut },
      });

      if (action === "DEMANDER") {
        await notifyRoles(tx, ["RESPONSABLE_MARKETING"], {
          titre: "Budget marketing à valider",
          message: `Le budget de la campagne « ${current.campagne.nom} » (${current.campagne.code}) attend une validation.`,
          priorite: "HAUTE",
          actionUrl: `/dashboard/admin/marketing/campagnes/${current.campagneId}`,
        });
      } else if (action === "VALIDER_RESPONSABLE") {
        await notifyRoles(tx, [], {
          titre: "Budget en attente de validation Direction",
          message: `Le budget de la campagne « ${current.campagne.nom} » (${current.campagne.code}) a franchi le palier marketing — validation Direction requise.`,
          priorite: "HAUTE",
          actionUrl: `/dashboard/admin/marketing/campagnes/${current.campagneId}`,
        });
      } else if (action === "APPROUVER" || action === "REJETER") {
        await notifyRoles(tx, ["RESPONSABLE_MARKETING"], {
          titre: action === "APPROUVER" ? "Budget approuvé" : "Budget rejeté",
          message: `Le budget de la campagne « ${current.campagne.nom} » (${current.campagne.code}) a été ${action === "APPROUVER" ? "approuvé" : "rejeté"}.`,
          priorite: "NORMAL",
          actionUrl: `/dashboard/admin/marketing/campagnes/${current.campagneId}`,
        });
      }

      return updated;
    });

    return NextResponse.json({ data: result });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "BUDGET_INTROUVABLE") {
      return NextResponse.json({ error: "Budget introuvable" }, { status: 404 });
    }
    if (e instanceof Error && e.message.startsWith("TRANSITION_INVALIDE:")) {
      return NextResponse.json({ error: e.message.slice("TRANSITION_INVALIDE:".length) }, { status: 409 });
    }
    console.error("POST /api/admin/marketing/budgets/[id]/action", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
