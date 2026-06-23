import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";

/**
 * GET /api/rvc/collecteurs
 * Liste légère des agents de terrain (collecteurs) du PDV du RVC, pour le
 * sélecteur « agent collecteur » des encaissements de remboursement.
 * Permet d'encaisser au nom d'un agent terrain pas forcément affecté au client.
 */
export async function GET() {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    let pdvId: number | null = null;
    if (!isAdmin) {
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId, actif: true },
        select: { pointDeVenteId: true },
      });
      if (!aff) return NextResponse.json({ error: "Aucun point de vente associé" }, { status: 400 });
      pdvId = aff.pointDeVenteId;
    }

    const agents = await prisma.gestionnaire.findMany({
      where: {
        role: "AGENT_TERRAIN",
        actif: true,
        ...(pdvId ? { member: { affectationsPDV: { some: { actif: true, pointDeVenteId: pdvId } } } } : {}),
      },
      select: { member: { select: { id: true, nom: true, prenom: true } } },
      orderBy: { member: { nom: "asc" } },
    });

    return NextResponse.json({ data: agents.map((a) => a.member) });
  } catch (error) {
    console.error("GET /api/rvc/collecteurs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
