import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { archiverExercice } from "@/lib/comptabilite/exercice";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

type Ctx = { params: Promise<{ id: string }> };

const MESSAGES: Record<string, [string, number]> = {
  EXERCICE_INTROUVABLE: ["Exercice introuvable", 404],
  EXERCICE_NON_CLOTURE: ["Seul un exercice déjà clôturé peut être archivé", 400],
};

/** POST /api/comptable/exercices/[id]/archiver — dernier statut du cycle de vie (CDC §28). */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const exercice = await prisma.exerciceComptable.findUnique({ where: { id: Number(id) } });
    if (!exercice) return NextResponse.json({ error: "Exercice introuvable" }, { status: 404 });

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    await prisma.$transaction(async (tx) => {
      await archiverExercice(tx, exercice.annee);
      await auditLog(tx, userId, "ARCHIVAGE_EXERCICE", "ExerciceComptable", exercice.id, { annee: exercice.annee }, meta);
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    if (e instanceof Error && MESSAGES[e.message]) {
      const [message, status] = MESSAGES[e.message];
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
