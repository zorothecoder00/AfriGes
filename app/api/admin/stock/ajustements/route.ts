import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

async function getAdminSession() {
  const s = await getAuthSession();
  if (!s) return null;
  if (s.user.role !== "ADMIN" && s.user.role !== "SUPER_ADMIN") return null;
  return s;
}

/**
 * GET /api/admin/stock/ajustements
 * Liste des demandes d'ajustement de stock soumises par les magasiniers.
 * Query: statut (EN_ATTENTE|APPROUVE|REJETE), page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit  = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip   = (page - 1) * limit;
    const statut = searchParams.get("statut") || undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut) where.statut = statut;

    const [demandes, total, totalEnAttente] = await Promise.all([
      prisma.demandeAjustementStock.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          produit:      { select: { id: true, nom: true, reference: true, unite: true } },
          pointDeVente: { select: { id: true, nom: true, code: true } },
          demandeur:    { select: { id: true, nom: true, prenom: true } },
          validateur:   { select: { id: true, nom: true, prenom: true } },
        },
      }),
      prisma.demandeAjustementStock.count({ where }),
      prisma.demandeAjustementStock.count({ where: { statut: "EN_ATTENTE" } }),
    ]);

    return NextResponse.json({
      data: demandes,
      stats: { totalEnAttente },
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/admin/stock/ajustements:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
