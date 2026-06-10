import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/responsableRH/recrutement/postes/[id]/candidatures */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const candidatures = await prisma.candidature.findMany({
      where:   { posteId: Number(id) },
      orderBy: { dateCandidature: "desc" },
    });

    return NextResponse.json({ data: candidatures });
  } catch (error) {
    console.error("GET candidatures/postes/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** POST /api/responsableRH/recrutement/postes/[id]/candidatures */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body   = await req.json();

    if (!body.nomCandidat || !body.prenomCandidat) {
      return NextResponse.json({ error: "Nom et prénom sont obligatoires" }, { status: 400 });
    }

    const poste = await prisma.posteOuvert.findUnique({ where: { id: Number(id) } });
    if (!poste) return NextResponse.json({ error: "Poste introuvable" }, { status: 404 });
    if (["ANNULE", "POURVU"].includes(poste.statut)) {
      return NextResponse.json({ error: "Ce poste n'accepte plus de candidatures" }, { status: 422 });
    }

    const candidature = await prisma.candidature.create({
      data: {
        posteId:          Number(id),
        nomCandidat:      body.nomCandidat,
        prenomCandidat:   body.prenomCandidat,
        email:            body.email            ?? null,
        telephone:        body.telephone        ?? null,
        cvUrl:            body.cvUrl            ?? null,
        lettreUrl:        body.lettreUrl        ?? null,
        notes:            body.notes            ?? null,
        competences:      body.competences      ?? null,
        formation:        body.formation        ?? null,
        experienceAnnees: body.experienceAnnees ? Number(body.experienceAnnees) : null,
        sourceCandidat:   body.sourceCandidat   ?? null,
        statut:           "RECU",
      },
    });

    return NextResponse.json({ data: candidature }, { status: 201 });
  } catch (error) {
    console.error("POST candidatures/postes/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
