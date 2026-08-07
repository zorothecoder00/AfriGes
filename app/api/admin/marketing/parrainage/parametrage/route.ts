import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";
import { chargerParametrageParrainage } from "@/lib/parrainage";

/** GET /api/admin/marketing/parrainage/parametrage — paramétrage singleton (points parrain/filleul). */
export async function GET() {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const param = await chargerParametrageParrainage();
    return NextResponse.json({ data: param });
  } catch (e) {
    console.error("GET /api/admin/marketing/parrainage/parametrage", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** PATCH /api/admin/marketing/parrainage/parametrage — édition (actif/pointsParrain/pointsFilleul). */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "MODIFICATION");
    if (denied) return denied;

    const body = await req.json();
    const { actif, pointsParrain, pointsFilleul } = body;
    const userId = Number(session.user.id);

    await chargerParametrageParrainage(); // s'assure que le singleton existe

    const param = await prisma.$transaction(async (tx) => {
      const updated = await tx.parametrageParrainage.update({
        where: { id: 1 },
        data: {
          ...(actif !== undefined ? { actif: Boolean(actif) } : {}),
          ...(pointsParrain !== undefined ? { pointsParrain: Number(pointsParrain) } : {}),
          ...(pointsFilleul !== undefined ? { pointsFilleul: Number(pointsFilleul) } : {}),
        },
      });
      await auditLog(tx, userId, "UPDATE", "ParametrageParrainage", 1);
      return updated;
    });

    return NextResponse.json({ data: param });
  } catch (e) {
    console.error("PATCH /api/admin/marketing/parrainage/parametrage", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
