import { NextResponse } from "next/server";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { deployerVarianteGagnante } from "@/lib/testAB";

type Ctx = { params: Promise<{ id: string }> };

const MESSAGES: Record<string, string> = {
  TEST_INTROUVABLE: "Test introuvable",
  TEST_NON_TERMINE: "Le test doit être terminé avant de déployer le gagnant",
  PAS_ECHANTILLON: "Ce test n'a pas de taille d'échantillon définie — toute l'audience a déjà reçu une variante",
  CAMPAGNE_SANS_AUDIENCE: "La campagne de ce test n'a pas d'audience associée",
  PAS_DE_GAGNANT: "Aucune variante gagnante ne se dégage (égalité ou pas assez de données)",
};

/** POST /api/admin/marketing/tests-ab/[id]/deployer — envoie la variante gagnante au reste de l'audience (CDC §72). */
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "CREATION");
    if (denied) return denied;

    const { id } = await params;
    const testId = Number(id);
    if (isNaN(testId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const userId = Number(session.user.id);
    try {
      const resultat = await deployerVarianteGagnante({ testId, userId });
      return NextResponse.json({ data: resultat });
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      if (MESSAGES[code]) return NextResponse.json({ error: MESSAGES[code] }, { status: code === "TEST_INTROUVABLE" ? 404 : 400 });
      throw e;
    }
  } catch (e) {
    console.error("POST /api/admin/marketing/tests-ab/[id]/deployer", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
