import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";

/**
 * Tests A/B marketing (CDC §7, Phase 7).
 * GET  — liste des tests.
 * POST — crée un test (BROUILLON, pas encore envoyé).
 */
export async function GET() {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const tests = await prisma.testAB.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        campagne: { select: { id: true, code: true, nom: true } },
        canal: { select: { id: true, libelle: true } },
        modeleA: { select: { id: true, nom: true } },
        modeleB: { select: { id: true, nom: true } },
        _count: { select: { assignations: true } },
      },
    });

    return NextResponse.json({ data: tests });
  } catch (e) {
    console.error("GET /api/admin/marketing/tests-ab", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "CREATION");
    if (denied) return denied;

    const body = await req.json();
    const { nom, campagneId, canalId, modeleAId, modeleBId } = body;

    const nomTrim = typeof nom === "string" ? nom.trim() : "";
    if (!nomTrim) return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
    if (!campagneId || !canalId || !modeleAId || !modeleBId) {
      return NextResponse.json({ error: "Campagne, canal et deux modèles de message sont requis" }, { status: 400 });
    }
    if (Number(modeleAId) === Number(modeleBId)) {
      return NextResponse.json({ error: "Les deux variantes doivent utiliser des modèles différents" }, { status: 400 });
    }

    const campagne = await prisma.campagne.findUnique({ where: { id: Number(campagneId) }, select: { id: true, audienceId: true } });
    if (!campagne) return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
    if (!campagne.audienceId) return NextResponse.json({ error: "Cette campagne n'a pas d'audience associée" }, { status: 422 });

    const userId = Number(session.user.id);
    const test = await prisma.$transaction(async (tx) => {
      const t = await tx.testAB.create({
        data: {
          nom: nomTrim, campagneId: Number(campagneId), canalId: Number(canalId),
          modeleAId: Number(modeleAId), modeleBId: Number(modeleBId), creeParId: userId,
        },
      });
      await auditLog(tx, userId, "TEST_AB_CREE", "TestAB", t.id);
      return t;
    });

    return NextResponse.json({ data: test }, { status: 201 });
  } catch (e) {
    console.error("POST /api/admin/marketing/tests-ab", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
