import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

const INCLUDE = {
  successeurs: {
    include: {
      profilRH: {
        select: {
          id: true, matricule: true, fonction: true, departement: true,
          gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
        },
      },
    },
    orderBy: { readiness: "asc" as const },
  },
};

/**
 * GET /api/admin/rh/carrieres/plan-succession
 * Liste des postes critiques avec leurs successeurs.
 * Query: actif?, departement?
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const actifParam  = searchParams.get("actif");
    const departement = searchParams.get("departement")?.trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (actifParam !== null) where.actif      = actifParam !== "false";
    if (departement)        where.departement = { contains: departement, mode: "insensitive" };

    const postes = await prisma.posteCritique.findMany({
      where,
      include:  INCLUDE,
      orderBy: [{ actif: "desc" }, { titre: "asc" }],
    });

    const stats = {
      total:     postes.length,
      couverts:  postes.filter((p) => p.successeurs.length >= p.nbSuccesseursRequis).length,
      critiques: postes.filter((p) => p.successeurs.length === 0).length,
      talents:   postes.reduce((s, p) => s + p.successeurs.filter((x) => x.estTalentCle).length, 0),
    };

    return NextResponse.json({ data: postes, stats });
  } catch (error) {
    console.error("GET /api/admin/rh/carrieres/plan-succession", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/carrieres/plan-succession
 * Créer un poste critique.
 * Body: { titre, departement?, description?, nbSuccesseursRequis? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { titre, departement, description, nbSuccesseursRequis } = body;

    if (!titre?.trim()) return NextResponse.json({ error: "titre requis" }, { status: 400 });

    const poste = await prisma.posteCritique.create({
      data: {
        titre,
        departement:         departement         ?? null,
        description:         description         ?? null,
        nbSuccesseursRequis: nbSuccesseursRequis ? Number(nbSuccesseursRequis) : 2,
      },
      include: INCLUDE,
    });

    return NextResponse.json({ data: poste }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/carrieres/plan-succession", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
