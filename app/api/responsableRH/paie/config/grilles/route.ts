import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";

/**
 * GET /api/responsableRH/paie/config/grilles — lecture seule
 * La configuration de paie est globale (entreprise) ; le RESPONSABLE_RH la
 * consulte sans pouvoir la modifier (création/édition réservées à l'admin).
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const grilles = await prisma.grilleSalariale.findMany({
      orderBy: [{ categorie: "asc" }, { niveau: "asc" }],
    });
    return NextResponse.json({ data: grilles });
  } catch (error) {
    console.error("GET /api/responsableRH/paie/config/grilles", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
