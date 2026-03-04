import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";

/**
 * GET /api/rpv/receptions-packs
 * Liste des réceptions de produits packs (livraisons aux clients).
 * Query: statut, search, page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit  = Math.min(50, Number(searchParams.get("limit") || 15));
    const skip   = (page - 1) * limit;
    const statut = searchParams.get("statut") || "";
    const search = searchParams.get("search") || "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut) where.statut = statut;
    if (search) {
      where.souscription = {
        OR: [
          { pack:   { nom: { contains: search, mode: "insensitive" } } },
          { client: { OR: [
            { nom:    { contains: search, mode: "insensitive" } },
            { prenom: { contains: search, mode: "insensitive" } },
          ]}},
          { user: { OR: [
            { nom:    { contains: search, mode: "insensitive" } },
            { prenom: { contains: search, mode: "insensitive" } },
          ]}},
        ],
      };
    }

    const [receptions, total] = await Promise.all([
      prisma.receptionProduitPack.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          souscription: {
            include: {
              pack:   { select: { nom: true, type: true } },
              user:   { select: { nom: true, prenom: true, telephone: true } },
              client: { select: { nom: true, prenom: true, telephone: true } },
            },
          },
          lignes: {
            include: { produit: { select: { nom: true } } },
          },
        },
      }),
      prisma.receptionProduitPack.count({ where }),
    ]);

    const stats = await prisma.receptionProduitPack.groupBy({
      by: ["statut"],
      _count: { id: true },
    });

    const statsMap: Record<string, number> = {};
    for (const s of stats) statsMap[s.statut] = s._count.id;

    return NextResponse.json({
      success: true,
      data: receptions.map((r) => ({
        id:                 r.id,
        souscriptionId:     r.souscriptionId,
        statut:             r.statut,
        datePrevisionnelle: r.datePrevisionnelle.toISOString(),
        dateLivraison:      r.dateLivraison?.toISOString() ?? null,
        livreurNom:         r.livreurNom,
        notes:              r.notes,
        createdAt:          r.createdAt.toISOString(),
        souscription: {
          pack:   r.souscription.pack,
          user:   r.souscription.user,
          client: r.souscription.client,
        },
        lignes: r.lignes.map((l) => ({
          id:          l.id,
          quantite:    l.quantite,
          prixUnitaire: l.prixUnitaire.toString(),
          produit:     l.produit,
        })),
      })),
      stats: {
        planifiees: statsMap["PLANIFIEE"] ?? 0,
        livrees:    statsMap["LIVREE"]    ?? 0,
        annulees:   statsMap["ANNULEE"]   ?? 0,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/rpv/receptions-packs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
