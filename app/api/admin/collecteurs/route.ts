import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/collecteurs
 * Liste légère des agents de terrain (collecteurs) pour le sélecteur
 * « agent collecteur » des encaissements de remboursement. Admin → tous.
 */
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const agents = await prisma.gestionnaire.findMany({
      where: { role: "AGENT_TERRAIN", actif: true },
      select: { member: { select: { id: true, nom: true, prenom: true } } },
      orderBy: { member: { nom: "asc" } },
    });

    return NextResponse.json({ data: agents.map((a) => a.member) });
  } catch (error) {
    console.error("GET /api/admin/collecteurs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
