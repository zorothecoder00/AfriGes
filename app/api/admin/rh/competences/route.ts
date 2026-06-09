import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { TypeCompetence } from "@prisma/client";

/**
 * GET /api/admin/rh/competences
 * Référentiel des compétences.
 * Query: type? (HARD_SKILL | SOFT_SKILL), categorie?, actif?, search?
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const type      = searchParams.get("type")      as TypeCompetence | null;
    const categorie = searchParams.get("categorie")?.trim();
    const actifParam = searchParams.get("actif");
    const search    = searchParams.get("search")?.trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (type)      where.type      = type;
    if (categorie) where.categorie = { contains: categorie, mode: "insensitive" };
    if (actifParam !== null) where.actif = actifParam !== "false";
    if (search)    where.nom       = { contains: search, mode: "insensitive" };

    const competences = await prisma.competence.findMany({
      where,
      orderBy: [{ type: "asc" }, { categorie: "asc" }, { nom: "asc" }],
      include: { _count: { select: { collaborateurCompetences: true } } },
    });

    // Stats par type
    const stats = {
      total:      competences.length,
      hardSkills: competences.filter((c) => c.type === "HARD_SKILL").length,
      softSkills: competences.filter((c) => c.type === "SOFT_SKILL").length,
      categories: [...new Set(competences.map((c) => c.categorie).filter(Boolean))],
    };

    return NextResponse.json({ data: competences, stats });
  } catch (error) {
    console.error("GET /api/admin/rh/competences", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/competences
 * Créer une compétence dans le référentiel.
 * Body: { nom, type, categorie?, description? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { nom, type, categorie, description } = body;

    if (!nom || !type) {
      return NextResponse.json({ error: "nom et type sont requis" }, { status: 400 });
    }
    if (!["HARD_SKILL", "SOFT_SKILL"].includes(type)) {
      return NextResponse.json({ error: "type invalide" }, { status: 400 });
    }

    // Vérifier doublon (même nom + type)
    const existing = await prisma.competence.findFirst({
      where: { nom: { equals: nom, mode: "insensitive" }, type: type as TypeCompetence },
    });
    if (existing) {
      return NextResponse.json({ error: "Une compétence avec ce nom existe déjà dans ce type" }, { status: 409 });
    }

    const competence = await prisma.competence.create({
      data: {
        nom,
        type:        type as TypeCompetence,
        categorie:   categorie   ?? null,
        description: description ?? null,
        actif:       true,
        createdById: parseInt(session.user.id),
      },
    });

    return NextResponse.json({ data: competence }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/competences", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
