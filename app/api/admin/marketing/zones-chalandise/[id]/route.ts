import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/** DELETE /api/admin/marketing/zones-chalandise/[id] — retire une entrée de la zone de chalandise. */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "SUPPRESSION_LOGIQUE");
    if (denied) return denied;

    const { id } = await params;
    const zoneId = Number(id);
    if (isNaN(zoneId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const userId = Number(session.user.id);
    await prisma.$transaction(async (tx) => {
      await tx.zoneChalandise.delete({ where: { id: zoneId } });
      await auditLog(tx, userId, "DELETE", "ZoneChalandise", zoneId);
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/admin/marketing/zones-chalandise/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
