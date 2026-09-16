import { NextResponse } from "next/server";
import { StatutActionRecouvrement } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { INCLUDE } from "../route";

type Ctx = { params: Promise<{ id: string; actionId: string }> };

/**
 * PATCH /api/admin/credits/[id]/recouvrement/[actionId]
 * Body: { statut: "RESOLU" | "SANS_SUITE", resultat? }
 * Clôt une action de recouvrement (ex : client régularisé après mise en
 * demeure, ou visite sans résultat).
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, actionId } = await params;
    const creditId = Number(id);
    const aId = Number(actionId);
    if (isNaN(creditId) || isNaN(aId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const action = await prisma.actionRecouvrementCredit.findUnique({ where: { id: aId } });
    if (!action || action.creditId !== creditId) {
      return NextResponse.json({ error: "Action introuvable" }, { status: 404 });
    }

    const body = await req.json();
    const statut = body.statut as StatutActionRecouvrement;
    if (!["RESOLU", "SANS_SUITE"].includes(statut)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }
    if (action.statut !== "EN_COURS") {
      return NextResponse.json({ error: `Action déjà clôturée (${action.statut})` }, { status: 422 });
    }

    const userId = parseInt(session.user.id);
    const updated = await prisma.$transaction(async (tx) => {
      const a = await tx.actionRecouvrementCredit.update({
        where: { id: aId },
        data: { statut, resultat: body.resultat ?? action.resultat },
        include: INCLUDE,
      });
      await auditLog(tx, userId, `RECOUV_CREDIT_${statut}`, "ActionRecouvrementCredit", aId, undefined, getRequestMeta(req));
      return a;
    });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /admin/credits/[id]/recouvrement/[actionId]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
