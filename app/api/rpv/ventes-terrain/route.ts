import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";

/**
 * GET /api/rpv/ventes-terrain
 * Liste les demandes de vente directe terrain (BROUILLON) en attente de confirmation
 * ainsi que les ventes CONFIRMEE et LIVREE récentes pour ce PDV.
 */
export async function GET(req: Request) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: parseInt(session.user.id), actif: true },
      select: { pointDeVenteId: true },
    });
    if (!aff?.pointDeVenteId) {
      return NextResponse.json({ error: "Aucun point de vente associé" }, { status: 400 });
    }
    const pdvId = aff.pointDeVenteId;

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut") || "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { pointDeVenteId: pdvId };
    if (statut) {
      where.statut = statut;
    } else {
      where.statut = { in: ["BROUILLON", "CONFIRMEE", "LIVREE"] };
    }

    const [ventes, total] = await Promise.all([
      prisma.venteDirecte.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          vendeur: { select: { id: true, nom: true, prenom: true } },
          client:  { select: { id: true, nom: true, prenom: true, telephone: true } },
          lignes: {
            include: { produit: { select: { id: true, nom: true, unite: true } } },
          },
        },
      }),
      prisma.venteDirecte.count({ where: { pointDeVenteId: pdvId, statut: "BROUILLON" } }),
    ]);

    return NextResponse.json({ data: ventes, totalEnAttente: total });
  } catch (error) {
    console.error("GET /rpv/ventes-terrain:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
