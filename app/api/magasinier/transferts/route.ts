import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";

/**
 * GET /api/magasinier/transferts
 * Liste des transferts impliquant les PDV du magasinier.
 * Redirige vers le même endpoint logistique/transferts avec filtre.
 * Query: statut, pdvId, page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page    = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit   = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 15)));
    const skip    = (page - 1) * limit;
    const statut   = searchParams.get("statut")   || "";
    const pdvId    = searchParams.get("pdvId");
    const entrants = searchParams.get("entrants") === "true";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (entrants) {
      // Transferts entrants à confirmer pour le PDV du magasinier
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId: parseInt(session.user.id), actif: true },
        select: { pointDeVenteId: true },
      });
      if (aff?.pointDeVenteId) {
        where.destinationId = aff.pointDeVenteId;
        where.statut = { in: ["EN_COURS", "EXPEDIE"] };
      }
    } else {
      if (statut) where.statut = statut;
      if (pdvId) {
        where.OR = [
          { origineId:      Number(pdvId) },
          { destinationId:  Number(pdvId) },
        ];
      }
    }

    const [transferts, total, pdvs] = await Promise.all([
      prisma.transfertStock.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          origine:     { select: { id: true, nom: true, code: true, type: true } },
          destination: { select: { id: true, nom: true, code: true, type: true } },
          creePar:     { select: { id: true, nom: true, prenom: true } },
          lignes: {
            include: { produit: { select: { id: true, nom: true, unite: true } } },
          },
        },
      }),
      prisma.transfertStock.count({ where }),
      prisma.pointDeVente.findMany({ where: { actif: true }, select: { id: true, nom: true, code: true, type: true }, orderBy: { nom: "asc" } }),
    ]);

    return NextResponse.json({
      data: transferts,
      pdvs,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /magasinier/transferts:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
