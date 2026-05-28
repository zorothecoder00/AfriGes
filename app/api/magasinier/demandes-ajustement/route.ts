import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";

/**
 * GET /api/magasinier/demandes-ajustement
 * Demandes d'ajustement soumises par ce magasinier (toutes, avec statut).
 * Query: statut, page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getMagasinierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);
    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit  = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 10)));
    const skip   = (page - 1) * limit;
    const statut = searchParams.get("statut") || undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { demandeurId: userId };
    if (statut) where.statut = statut;

    const [demandes, total] = await Promise.all([
      prisma.demandeAjustementStock.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          produit:      { select: { id: true, nom: true, unite: true } },
          pointDeVente: { select: { id: true, nom: true } },
          validateur:   { select: { id: true, nom: true, prenom: true } },
        },
      }),
      prisma.demandeAjustementStock.count({ where }),
    ]);

    return NextResponse.json({
      data: demandes,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/magasinier/demandes-ajustement:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
