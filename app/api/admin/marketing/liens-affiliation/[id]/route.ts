import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/admin/marketing/liens-affiliation/[id] — actif/destination. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "MODIFICATION");
    if (denied) return denied;

    const { id } = await params;
    const lienId = Number(id);
    if (isNaN(lienId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { actif, destinationUrl } = body;
    const userId = Number(session.user.id);

    const lien = await prisma.$transaction(async (tx) => {
      const updated = await tx.lienAffiliation.update({
        where: { id: lienId },
        data: {
          ...(actif !== undefined ? { actif: Boolean(actif) } : {}),
          ...(destinationUrl !== undefined ? { destinationUrl: destinationUrl || null } : {}),
        },
      });
      await auditLog(tx, userId, "UPDATE", "LienAffiliation", lienId, { actif });
      return updated;
    });

    return NextResponse.json({ data: lien });
  } catch (e) {
    console.error("PATCH /api/admin/marketing/liens-affiliation/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
