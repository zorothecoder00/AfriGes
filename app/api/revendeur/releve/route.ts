import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRevendeurSession } from "@/lib/authRevendeur";
import { statsAchatsRevendeur } from "@/lib/revendeur";

/**
 * GET /api/revendeur/releve — "Relevé de compte revendeur" + "État des
 * achats" (§5.6) : liste des factures émises pour ce compte + synthèse.
 */
export async function GET() {
  try {
    const session = await getRevendeurSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);
    const factures = await prisma.factureVente.findMany({
      where: { revendeurId: userId },
      orderBy: { dateEmission: "desc" },
      include: { lignes: true },
    });

    const stats = await statsAchatsRevendeur(userId);
    return NextResponse.json({ data: factures, stats });
  } catch (error) {
    console.error("GET /revendeur/releve:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
