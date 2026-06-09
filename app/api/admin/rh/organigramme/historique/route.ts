import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/rh/organigramme/historique
 * Timeline globale de tous les mouvements organisationnels
 *
 * Query: page, limit
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip  = (page - 1) * limit;

    const [historique, total] = await Promise.all([
      prisma.historiquePoste.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          profilRH: {
            select: {
              id: true, matricule: true, fonction: true,
              gestionnaire: {
                select: { member: { select: { nom: true, prenom: true, photo: true } } },
              },
            },
          },
        },
      }),
      prisma.historiquePoste.count(),
    ]);

    // Résoudre les noms des anciens/nouveaux managers
    const managerIds = [
      ...new Set(
        historique.flatMap((h) => [h.ancienManagerId, h.nouveauManagerId].filter(Boolean) as number[])
      ),
    ];

    const managers = managerIds.length > 0
      ? await prisma.profilRH.findMany({
          where: { id: { in: managerIds } },
          select: {
            id: true,
            gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
          },
        })
      : [];

    const managerMap = new Map(managers.map((m) => [m.id, m.gestionnaire?.member]));

    const data = historique.map((h) => ({
      ...h,
      ancienManager:   h.ancienManagerId  ? managerMap.get(h.ancienManagerId)  ?? null : null,
      nouveauManager:  h.nouveauManagerId ? managerMap.get(h.nouveauManagerId) ?? null : null,
    }));

    return NextResponse.json({
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/admin/rh/organigramme/historique", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
