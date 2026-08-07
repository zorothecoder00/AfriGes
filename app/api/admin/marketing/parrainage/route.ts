import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";

/** GET /api/admin/marketing/parrainage — liste des parrainages + statuts. */
export async function GET() {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const parrainages = await prisma.parrainage.findMany({
      orderBy: { dateInscription: "desc" },
      include: {
        parrain: { select: { id: true, nom: true, prenom: true, codeParrainage: true } },
        filleul: { select: { id: true, nom: true, prenom: true } },
      },
    });

    return NextResponse.json({ data: parrainages });
  } catch (e) {
    console.error("GET /api/admin/marketing/parrainage", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
