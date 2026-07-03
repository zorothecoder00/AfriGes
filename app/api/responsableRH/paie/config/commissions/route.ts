import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";

/**
 * GET /api/responsableRH/paie/config/commissions — lecture seule
 * Barèmes de commissions (global entreprise). Édition réservée à l'admin.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const baremes = await prisma.baremeCommission.findMany({
      orderBy: [{ profilCible: "asc" }, { libelle: "asc" }],
    });
    return NextResponse.json({ data: baremes });
  } catch (error) {
    console.error("GET /api/responsableRH/paie/config/commissions", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
