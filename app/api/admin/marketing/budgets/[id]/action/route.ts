import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { notifyRoles, auditLog } from "@/lib/notifications";
import type { StatutBudgetMarketing } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };
type BudgetAction = "DEMANDER" | "APPROUVER" | "REJETER";

const TRANSITIONS: Record<BudgetAction, StatutBudgetMarketing> = {
  DEMANDER:  "DEMANDE",
  APPROUVER: "APPROUVE",
  REJETER:   "REJETE",
};
const PRECONDITIONS: Record<BudgetAction, StatutBudgetMarketing[]> = {
  DEMANDER:  ["BROUILLON", "REJETE"],
  APPROUVER: ["DEMANDE"],
  REJETER:   ["DEMANDE"],
};

/**
 * POST /api/admin/marketing/budgets/[id]/action
 * Workflow budget (CDC §54) : Marketing demande → Responsable/Direction valide.
 * Body: { action: "DEMANDER"|"APPROUVER"|"REJETER", montantApprouve? }
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

    const permission = action === "APPROUVER" || action === "REJETER" ? "VALIDATION" : "MODIFICATION";
    const denied = await requirePermission(session, "marketing", permission);
    if (denied) return denied;

    const userId = Number(session.user.id);
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.budgetMarketing.findUnique({ where: { id: budgetId }, include: { campagne: true } });
      if (!current) throw new Error("BUDGET_INTROUVABLE");
      if (!PRECONDITIONS[action].includes(current.statut)) {
        throw new Error(`TRANSITION_INVALIDE:Action « ${action} » impossible depuis le statut « ${current.statut} »`);
      }

      const data: Record<string, unknown> = { statut: TRANSITIONS[action] };
      if (action === "DEMANDER") data.demandeParId = userId;
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
        await notifyRoles(tx, ["DIRECTEUR_GENERAL"], {
          titre: "Budget marketing à valider",
          message: `Le budget de la campagne « ${current.campagne.nom} » (${current.campagne.code}) attend une validation.`,
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
