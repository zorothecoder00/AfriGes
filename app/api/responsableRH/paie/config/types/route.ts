import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";

/**
 * GET /api/responsableRH/paie/config/types — lecture seule
 * Types de composants de paie (global entreprise). Édition réservée à l'admin.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const types = await prisma.typeComposantPaie.findMany({
      orderBy: [{ categorie: "asc" }, { libelle: "asc" }],
    });
    return NextResponse.json({ data: types });
  } catch (error) {
    console.error("GET /api/responsableRH/paie/config/types", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
