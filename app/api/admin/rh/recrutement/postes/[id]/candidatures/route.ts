import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await params;
    const candidatures = await prisma.candidature.findMany({
      where: { posteId: Number(id) },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: candidatures });
  } catch (error) {
    console.error("GET candidatures", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id }  = await params;
    const body    = await req.json();
    const {
      nomCandidat, prenomCandidat, email, telephone,
      cvUrl, lettreUrl, notes, competences, formation,
      experienceAnnees, sourceCandidat,
    } = body;

    if (!nomCandidat || !prenomCandidat) {
      return NextResponse.json({ error: "nomCandidat et prenomCandidat sont obligatoires" }, { status: 400 });
    }

    const poste = await prisma.posteOuvert.findUnique({ where: { id: Number(id) } });
    if (!poste) return NextResponse.json({ error: "Poste introuvable" }, { status: 404 });
    if (poste.statut === "ANNULE" || poste.statut === "POURVU") {
      return NextResponse.json({ error: "Ce poste n'accepte plus de candidatures" }, { status: 422 });
    }

    const candidature = await prisma.candidature.create({
      data: {
        posteId:          Number(id),
        nomCandidat,
        prenomCandidat,
        email:            email            ?? null,
        telephone:        telephone        ?? null,
        cvUrl:            cvUrl            ?? null,
        lettreUrl:        lettreUrl        ?? null,
        notes:            notes            ?? null,
        competences:      competences      ?? null,
        formation:        formation        ?? null,
        experienceAnnees: experienceAnnees ? Number(experienceAnnees) : null,
        sourceCandidat:   sourceCandidat   ?? null,
        statut:           "RECU",
      },
    });

    return NextResponse.json({ data: candidature }, { status: 201 });
  } catch (error) {
    console.error("POST candidatures", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
