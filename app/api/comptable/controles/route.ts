import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableLectureSession } from "@/lib/authComptable";
import { executerControles } from "@/lib/comptabilite/controles";

/**
 * GET /api/comptable/controles
 * Contrôles de cohérence comptable (CDC §40-42) : erreurs bloquantes, anomalies,
 * comptes d'attente, doublons potentiels. Lecture seule — ouvert aux rôles de
 * consultation (Directeur, Auditeur, Actionnaire) via getComptableLectureSession (CDC §43).
 */
export async function GET() {
  try {
    const session = await getComptableLectureSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const constats = await executerControles(prisma);
    const bloquants = constats.filter((c) => c.gravite === "BLOQUANT").length;
    const anomalies = constats.filter((c) => c.gravite === "ANOMALIE").length;

    return NextResponse.json({ data: constats, meta: { bloquants, anomalies, total: constats.length } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
