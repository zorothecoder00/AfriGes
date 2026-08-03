import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { executerControles } from "@/lib/comptabilite/controles";

/**
 * GET /api/comptable/controles
 * Contrôles de cohérence comptable (CDC §40-42) : erreurs bloquantes, anomalies,
 * comptes d'attente, doublons potentiels.
 */
export async function GET() {
  try {
    const session = await getComptableSession();
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
