import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";

/** GET /api/comptable/points-de-vente — liste légère (id, nom, code) pour les filtres "agence" (CDC §33). */
export async function GET() {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const points = await prisma.pointDeVente.findMany({
      where: { actif: true },
      select: { id: true, nom: true, code: true },
      orderBy: { nom: "asc" },
    });
    return NextResponse.json({ data: points });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
