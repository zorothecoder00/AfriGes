import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { Prisma } from "@prisma/client";

/**
 * GET — Historique des livraisons directes par pack.
 *   ?search=jean&page=1&limit=20
 */
export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
    const limit  = Math.min(50, parseInt(searchParams.get("limit") ?? "20"));
    const search = searchParams.get("search") ?? "";
    // "PLANIFIEE" | "LIVREE" | "ALL" (défaut : ALL)
    const statutFilter = searchParams.get("statut") ?? "ALL";

    const searchWhere: Prisma.ReceptionProduitPackWhereInput =
      search.length >= 2
        ? {
            souscription: {
              OR: [
                { client: { nom:       { contains: search, mode: "insensitive" } } },
                { client: { prenom:    { contains: search, mode: "insensitive" } } },
                { client: { telephone: { contains: search } } },
                { user:   { nom:       { contains: search, mode: "insensitive" } } },
                { user:   { prenom:    { contains: search, mode: "insensitive" } } },
              ],
            },
          }
        : {};

    const where: Prisma.ReceptionProduitPackWhereInput = {
      // Par défaut (ALL), on exclut les annulées pour ne pas polluer l'historique
      ...(statutFilter === "ANNULEE"
        ? { statut: "ANNULEE" }
        : statutFilter !== "ALL"
        ? { statut: statutFilter as "PLANIFIEE" | "LIVREE" }
        : { NOT: { statut: "ANNULEE" } }),
      ...searchWhere,
    };

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [receptions, total, totalPlanifiees, totalLivrees, ceMois] = await Promise.all([
      prisma.receptionProduitPack.findMany({
        where,
        // PLANIFIEE en tête, puis LIVREE ; dans chaque groupe : plus récent d'abord
        orderBy: [{ statut: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          souscription: {
            include: {
              pack:   { select: { nom: true, type: true } },
              client: { select: { nom: true, prenom: true, telephone: true } },
              user:   { select: { nom: true, prenom: true } },
            },
          },
          lignes: {
            include: { produit: { select: { nom: true } } },
          },
        },
      }),
      prisma.receptionProduitPack.count({ where }),
      prisma.receptionProduitPack.count({ where: { statut: "PLANIFIEE" } }),
      prisma.receptionProduitPack.count({ where: { statut: "LIVREE" } }),
      prisma.receptionProduitPack.count({
        where: { statut: "LIVREE", createdAt: { gte: startOfMonth } },
      }),
    ]);

    // Montant total calculé uniquement sur les livraisons réelles (LIVREE)
    const allLignes = await prisma.ligneReceptionPack.findMany({
      where: { reception: { statut: "LIVREE" } },
      select: { quantite: true, prixUnitaire: true },
    });
    const montantTotal = allLignes.reduce(
      (acc, l) => acc + Number(l.prixUnitaire) * l.quantite,
      0
    );

    // Clients uniques servis (LIVREE)
    const souscriptionsUniques = await prisma.receptionProduitPack.groupBy({
      by: ["souscriptionId"],
      where: { statut: "LIVREE" },
    });

    return NextResponse.json({
      receptions,
      meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
      stats: {
        totalLivraisons: totalLivrees,
        totalPlanifiees,
        montantTotal,
        clientsActifs: souscriptionsUniques.length,
        ceMois,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/packs/receptions", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
