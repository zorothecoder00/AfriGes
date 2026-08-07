import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";
import { chargerParametrageRFM } from "@/lib/audienceMarketing";

/**
 * GET/PATCH /api/admin/marketing/parametrage-rfm
 * Seuils de la segmentation RFM (CDC §81, sans code) — singleton éditable.
 */
export async function GET() {
  const session = await getMarketingSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const denied = await requirePermission(session, "marketing", "LECTURE");
  if (denied) return denied;

  const param = await chargerParametrageRFM();
  return NextResponse.json({ data: param });
}

const CHAMPS_NUMERIQUES = [
  "seuilPerduJours", "seuilDormantJours", "seuilRisqueJours", "seuilRisqueFrequenceMin",
  "seuilChampionFrequence", "seuilChampionRecenceJours", "seuilFideleFrequence",
] as const;

export async function PATCH(req: NextRequest) {
  const session = await getMarketingSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const denied = await requirePermission(session, "marketing", "MODIFICATION");
  if (denied) return denied;

  const body = await req.json();
  const userId = Number(session.user.id);

  await chargerParametrageRFM(); // s'assure que le singleton existe

  const data: Record<string, number> = {};
  for (const champ of CHAMPS_NUMERIQUES) {
    if (body[champ] !== undefined) data[champ] = Number(body[champ]);
  }
  if (body.percentileGrosAcheteur !== undefined) {
    const p = Number(body.percentileGrosAcheteur);
    if (p < 0 || p > 1) return NextResponse.json({ error: "percentileGrosAcheteur doit être entre 0 et 1" }, { status: 400 });
    data.percentileGrosAcheteur = p;
  }

  const param = await prisma.$transaction(async (tx) => {
    const updated = await tx.parametrageRFM.update({ where: { id: 1 }, data });
    await auditLog(tx, userId, "UPDATE", "ParametrageRFM", 1);
    return updated;
  });

  return NextResponse.json({ data: param });
}
