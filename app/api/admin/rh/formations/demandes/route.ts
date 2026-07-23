import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

const INCLUDE_PROFIL = {
  select: {
    id: true, matricule: true,
    gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
  },
};

/**
 * GET /api/admin/rh/formations/demandes
 * Liste les demandes de formation self-service.
 * Query: statut?, profilRHId?, page?, limit?
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const statut     = searchParams.get("statut");
    const profilRHId = searchParams.get("profilRHId");
    const page        = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit       = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 30)));
    const skip        = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut)     where.statut     = statut;
    if (profilRHId) where.profilRHId = Number(profilRHId);

    const [demandes, total, statsByStatut] = await Promise.all([
      prisma.demandeFormation.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: "desc" },
        include: { profilRH: INCLUDE_PROFIL, formation: { select: { id: true, titre: true, dateDebut: true } } },
      }),
      prisma.demandeFormation.count({ where }),
      prisma.demandeFormation.groupBy({ by: ["statut"], _count: { id: true } }),
    ]);

    const stats = Object.fromEntries(statsByStatut.map((s) => [s.statut, s._count.id]));

    return NextResponse.json({ data: demandes, meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, stats });
  } catch (error) {
    console.error("GET /api/admin/rh/formations/demandes", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
