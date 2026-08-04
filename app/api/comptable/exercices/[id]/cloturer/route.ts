import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { cloturerExercice } from "@/lib/comptabilite/exercice";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

type Ctx = { params: Promise<{ id: string }> };

const MESSAGES: Record<string, [string, number]> = {
  EXERCICE_INTROUVABLE: ["Exercice introuvable", 404],
  DEJA_CLOTURE: ["Cet exercice est déjà clôturé", 422],
};

/**
 * POST /api/comptable/exercices/[id]/cloturer
 * Clôture définitive (CDC §31) : bloque si l'assistant de contrôles (§40) remonte
 * une anomalie bloquante, sinon détermine le résultat, le reporte à nouveau et
 * verrouille les 12 mois de l'année.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const exercice = await prisma.exerciceComptable.findUnique({ where: { id: Number(id) } });
    if (!exercice) return NextResponse.json({ error: "Exercice introuvable" }, { status: 404 });

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const result = await prisma.$transaction(async (tx) => {
      const r = await cloturerExercice(tx, exercice.annee, userId);
      if (r.controlesBloquants.length === 0) {
        await auditLog(tx, userId, "CLOTURE_EXERCICE", "ExerciceComptable", exercice.id, { annee: exercice.annee }, meta);
      }
      return r;
    });

    if (result.controlesBloquants.length > 0) {
      return NextResponse.json(
        { error: "Clôture bloquée par des anomalies non résolues", controles: result.controlesBloquants },
        { status: 422 },
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("POST /api/comptable/exercices/[id]/cloturer", error);
    if (error instanceof Error && MESSAGES[error.message]) {
      const [message, status] = MESSAGES[error.message];
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
