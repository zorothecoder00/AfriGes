import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableLectureSession } from "@/lib/authComptable";
import { requirePermission } from "@/lib/permissions";
import { genererAlertes } from "@/lib/comptabilite/alertes";

/**
 * GET /api/comptable/alertes
 * Alertes à 4 paliers (CDC §73) : critique/attention/à traiter/ok.
 */
export async function GET() {
  try {
    const session = await getComptableLectureSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "comptabilite", "LECTURE");
    if (denied) return denied;

    const data = await genererAlertes(prisma);
    return NextResponse.json({ data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
