import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/rh/collaborateurs/[id]/historique-poste
 * Retourne l'historique organisationnel d'un collaborateur
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;

    const profil = await prisma.profilRH.findUnique({ where: { id: Number(id) } });
    if (!profil) return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 });

    const historique = await prisma.historiquePoste.findMany({
      where: { profilRHId: Number(id) },
      orderBy: { createdAt: "desc" },
    });

    // Résoudre noms des managers
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
      ancienManager:  h.ancienManagerId  ? managerMap.get(h.ancienManagerId)  ?? null : null,
      nouveauManager: h.nouveauManagerId ? managerMap.get(h.nouveauManagerId) ?? null : null,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/admin/rh/collaborateurs/[id]/historique-poste", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
