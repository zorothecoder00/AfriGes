import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/admin/marketing/recompenses/[id] — édition du catalogue. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "MODIFICATION");
    if (denied) return denied;

    const { id } = await params;
    const recompenseId = Number(id);
    if (isNaN(recompenseId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { nom, description, coutPoints, valeur, actif, dateExpiration } = body;
    const userId = Number(session.user.id);

    const recompense = await prisma.$transaction(async (tx) => {
      const updated = await tx.recompenseFidelite.update({
        where: { id: recompenseId },
        data: {
          ...(nom !== undefined ? { nom } : {}),
          ...(description !== undefined ? { description: description || null } : {}),
          ...(coutPoints !== undefined ? { coutPoints: Number(coutPoints) } : {}),
          ...(valeur !== undefined ? { valeur: valeur === null || valeur === "" ? null : new Prisma.Decimal(Number(valeur)) } : {}),
          ...(actif !== undefined ? { actif: Boolean(actif) } : {}),
          ...(dateExpiration !== undefined ? { dateExpiration: dateExpiration ? new Date(dateExpiration) : null } : {}),
        },
      });
      await auditLog(tx, userId, "UPDATE", "RecompenseFidelite", recompenseId, { actif });
      return updated;
    });

    return NextResponse.json({ data: { ...recompense, valeur: recompense.valeur !== null ? Number(recompense.valeur) : null } });
  } catch (e) {
    console.error("PATCH /api/admin/marketing/recompenses/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
