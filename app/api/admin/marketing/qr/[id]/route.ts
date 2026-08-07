import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/admin/marketing/qr/[id] — actif/destination. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "MODIFICATION");
    if (denied) return denied;

    const { id } = await params;
    const qrId = Number(id);
    if (isNaN(qrId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { actif, destinationUrl } = body;
    const userId = Number(session.user.id);

    const qr = await prisma.$transaction(async (tx) => {
      const updated = await tx.qrCodeMarketing.update({
        where: { id: qrId },
        data: {
          ...(actif !== undefined ? { actif: Boolean(actif) } : {}),
          ...(destinationUrl !== undefined ? { destinationUrl: destinationUrl || null } : {}),
        },
      });
      await auditLog(tx, userId, "UPDATE", "QrCodeMarketing", qrId, { actif });
      return updated;
    });

    return NextResponse.json({ data: qr });
  } catch (e) {
    console.error("PATCH /api/admin/marketing/qr/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
