import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { statsTestAB } from "@/lib/testAB";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/marketing/tests-ab/[id] — détail + statistiques comparatives A/B. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const { id } = await params;
    const testId = Number(id);
    if (isNaN(testId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const test = await prisma.testAB.findUnique({
      where: { id: testId },
      include: {
        campagne: { select: { id: true, code: true, nom: true } },
        canal: { select: { id: true, libelle: true } },
        modeleA: { select: { id: true, nom: true } },
        modeleB: { select: { id: true, nom: true } },
      },
    });
    if (!test) return NextResponse.json({ error: "Test introuvable" }, { status: 404 });

    const stats = test.statut === "BROUILLON" ? null : await statsTestAB(testId);

    return NextResponse.json({ data: test, stats });
  } catch (e) {
    console.error("GET /api/admin/marketing/tests-ab/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
