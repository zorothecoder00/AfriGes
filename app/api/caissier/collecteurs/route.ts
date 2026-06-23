import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCaissierSession, getCaissierPdvId } from "@/lib/authCaissier";

/**
 * GET /api/caissier/collecteurs
 * Liste légère des agents de terrain (collecteurs) du PDV du caissier, pour le
 * sélecteur « agent collecteur » des encaissements de remboursement au comptoir.
 */
export async function GET() {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId   = isAdmin ? null : await getCaissierPdvId(userId);

    if (!isAdmin && !pdvId) {
      return NextResponse.json({ error: "Aucun point de vente associé" }, { status: 400 });
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
    console.error("GET /api/caissier/collecteurs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
