import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/public/postes/[id]/candidatures — sans auth, formulaire public */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const body   = await req.json();

    const { prenomCandidat, nomCandidat, email, telephone,
            cvUrl, lettreUrl, formation, competences,
            experienceAnnees, notes } = body;

    if (!prenomCandidat?.trim() || !nomCandidat?.trim()) {
      return NextResponse.json({ error: "Prénom et nom sont obligatoires" }, { status: 400 });
    }
    if (!email?.trim()) {
      return NextResponse.json({ error: "L'adresse email est obligatoire" }, { status: 400 });
    }

    const poste = await prisma.posteOuvert.findUnique({
      where: { id: Number(id) },
      select: { id: true, statut: true, titre: true },
    });

    if (!poste) {
      return NextResponse.json({ error: "Poste introuvable" }, { status: 404 });
    }
    if (!["OUVERT", "EN_COURS"].includes(poste.statut)) {
      return NextResponse.json({ error: "Ce poste n'accepte plus de candidatures" }, { status: 410 });
    }

    // Empêcher la double candidature (même email, même poste)
    const doublon = await prisma.candidature.findFirst({
      where: { posteId: Number(id), email: email.trim().toLowerCase() },
    });
    if (doublon) {
      return NextResponse.json(
        { error: "Vous avez déjà postulé à ce poste avec cette adresse email" },
        { status: 409 }
      );
    }

    const candidature = await prisma.candidature.create({
      data: {
        posteId:          Number(id),
        prenomCandidat:   prenomCandidat.trim(),
        nomCandidat:      nomCandidat.trim(),
        email:            email.trim().toLowerCase(),
        telephone:        telephone?.trim()        || null,
        cvUrl:            cvUrl?.trim()            || null,
        lettreUrl:        lettreUrl?.trim()        || null,
        formation:        formation?.trim()        || null,
        competences:      competences?.trim()      || null,
        experienceAnnees: experienceAnnees ? Number(experienceAnnees) : null,
        notes:            notes?.trim()            || null,
        sourceCandidat:   "Formulaire public",
        statut:           "RECU",
      },
    });

    return NextResponse.json(
      { data: { id: candidature.id }, message: "Candidature reçue avec succès" },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/public/postes/[id]/candidatures", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
