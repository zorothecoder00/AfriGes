import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";
import { getSession } from "../../../fournisseurs/route";
import { INCLUDE } from "../route";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const convention = await prisma.conventionDepotVente.findUnique({ where: { id: Number(id) }, include: INCLUDE });
    if (!convention) return NextResponse.json({ error: "Convention introuvable" }, { status: 404 });

    return NextResponse.json({ data: convention });
  } catch (error) {
    console.error("GET /logistique/depot-vente/conventions/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/logistique/depot-vente/conventions/[id]
 * Body : { action: "SUSPENDRE" | "REACTIVER" | "TERMINER" }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const conventionId = Number(id);
    const convention = await prisma.conventionDepotVente.findUnique({ where: { id: conventionId } });
    if (!convention) return NextResponse.json({ error: "Convention introuvable" }, { status: 404 });

    const body = await req.json();
    const TRANSITIONS: Record<string, { from: string[]; to: string }> = {
      SUSPENDRE: { from: ["ACTIVE"], to: "SUSPENDUE" },
      REACTIVER: { from: ["SUSPENDUE"], to: "ACTIVE" },
      TERMINER: { from: ["ACTIVE", "SUSPENDUE"], to: "TERMINEE" },
    };
    const t = TRANSITIONS[body.action];
    if (!t) return NextResponse.json({ error: "Action invalide" }, { status: 400 });
    if (!t.from.includes(convention.statut)) {
      return NextResponse.json({ error: `Impossible depuis le statut ${convention.statut}` }, { status: 422 });
    }

    const userId = parseInt(session.user.id);
    const updated = await prisma.$transaction(async (tx) => {
      const c = await tx.conventionDepotVente.update({ where: { id: conventionId }, data: { statut: t.to as never }, include: INCLUDE });
      await auditLog(tx, userId, `CDV_${body.action}`, "ConventionDepotVente", conventionId, { avant: convention.statut, apres: t.to }, getRequestMeta(req));
      return c;
    });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /logistique/depot-vente/conventions/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
