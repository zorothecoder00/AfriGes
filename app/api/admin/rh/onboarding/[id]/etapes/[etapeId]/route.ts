import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string; etapeId: string }> };

/**
 * PATCH /api/admin/rh/onboarding/[id]/etapes/[etapeId]
 * Marquer une étape FAIT ou IGNORE, et recalculer la progression de l'onboarding.
 *
 * Body: {
 *   statut:       "FAIT" | "IGNORE" | "EN_ATTENTE"
 *   commentaire?: string
 *   responsableId?: number
 * }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, etapeId } = await params;
    const body = await req.json();
    const { statut, commentaire, responsableId } = body;

    if (!statut || !["FAIT", "IGNORE", "EN_ATTENTE"].includes(statut)) {
      return NextResponse.json({ error: "statut invalide (FAIT | IGNORE | EN_ATTENTE)" }, { status: 400 });
    }

    const etape = await prisma.etapeOnboarding.findUnique({
      where: { id: Number(etapeId) },
    });
    if (!etape) return NextResponse.json({ error: "Étape introuvable" }, { status: 404 });
    if (etape.onboardingId !== Number(id)) {
      return NextResponse.json({ error: "Étape n'appartient pas à cet onboarding" }, { status: 400 });
    }

    // Mise à jour de l'étape + recalcul progression en une transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Mettre à jour l'étape
      const updated = await tx.etapeOnboarding.update({
        where: { id: Number(etapeId) },
        data: {
          statut,
          dateFaite:     statut === "FAIT"       ? new Date() : null,
          commentaire:   commentaire             ?? etape.commentaire,
          responsableId: responsableId !== undefined ? Number(responsableId) : etape.responsableId,
        },
      });

      // 2. Recalculer progression sur les étapes obligatoires
      const toutesEtapes  = await tx.etapeOnboarding.findMany({ where: { onboardingId: Number(id) } });
      const obligatoires  = toutesEtapes.filter((e) => e.obligatoire);
      const faites        = obligatoires.filter((e) => e.statut === "FAIT");
      const progression   = obligatoires.length > 0
        ? Math.round((faites.length / obligatoires.length) * 100)
        : 0;

      // 3. Terminer l'onboarding automatiquement si toutes les étapes obligatoires sont FAIT
      const toutTermine = obligatoires.length > 0 && faites.length === obligatoires.length;
      const onboarding  = await tx.onboardingEmploye.update({
        where: { id: Number(id) },
        data: {
          progressionPct: progression,
          ...(toutTermine ? { statut: "TERMINE", dateCloture: new Date() } : {}),
        },
      });

      return { etape: updated, onboarding };
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("PATCH /api/admin/rh/onboarding/[id]/etapes/[etapeId]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
