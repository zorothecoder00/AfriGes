import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutCandidature } from "@prisma/client";

/**
 * GET /api/admin/rh/recrutement/candidatures
 * Base CV — recherche multicritères sur l'ensemble des candidatures
 *
 * Query:
 *   search       — nom, prénom, email, formation, compétences
 *   statut       — StatutCandidature
 *   posteId      — filtrer par poste
 *   sourceCandidat
 *   scoreMin     — score minimum /100
 *   page, limit
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const search         = searchParams.get("search")?.trim()         ?? "";
    const statut         = searchParams.get("statut") as StatutCandidature | null;
    const posteId        = searchParams.get("posteId");
    const sourceCandidat = searchParams.get("sourceCandidat")?.trim() ?? "";
    const scoreMin       = searchParams.get("scoreMin");
    const page           = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit          = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip           = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (statut)         where.statut         = statut;
    if (posteId)        where.posteId        = Number(posteId);
    if (sourceCandidat) where.sourceCandidat = { contains: sourceCandidat, mode: "insensitive" };
    if (scoreMin)       where.scoreCandidat  = { gte: Number(scoreMin) };

    if (search) {
      where.OR = [
        { nomCandidat:    { contains: search, mode: "insensitive" } },
        { prenomCandidat: { contains: search, mode: "insensitive" } },
        { email:          { contains: search, mode: "insensitive" } },
        { formation:      { contains: search, mode: "insensitive" } },
        { competences:    { contains: search, mode: "insensitive" } },
      ];
    }

    const [candidatures, total] = await Promise.all([
      prisma.candidature.findMany({
        where, skip, take: limit,
        orderBy: [{ scoreCandidat: "desc" }, { dateCandidature: "desc" }],
        include: {
          poste: { select: { id: true, reference: true, titre: true, departement: true, statut: true } },
        },
      }),
      prisma.candidature.count({ where }),
    ]);

    // Stats globales pour le tableau de bord ATS
    const [statsStatut, totalCandidats, moyenneScore] = await Promise.all([
      prisma.candidature.groupBy({ by: ["statut"], _count: { id: true } }),
      prisma.candidature.count(),
      prisma.candidature.aggregate({ _avg: { scoreCandidat: true } }),
    ]);

    const statsMap = Object.fromEntries(statsStatut.map((s) => [s.statut, s._count.id]));

    return NextResponse.json({
      data: candidatures,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      ats: {
        totalCandidats,
        moyenneScore: moyenneScore._avg.scoreCandidat ?? 0,
        parStatut: statsMap,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/rh/recrutement/candidatures", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
