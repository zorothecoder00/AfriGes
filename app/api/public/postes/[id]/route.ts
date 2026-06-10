import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/public/postes/[id] — fiche poste publique, sans auth */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;

    const poste = await prisma.posteOuvert.findUnique({
      where: { id: Number(id) },
      select: {
        id: true,
        reference: true,
        titre: true,
        departement: true,
        service: true,
        lieu: true,
        typeContrat: true,
        description: true,
        exigences: true,
        competencesRequises: true,
        experienceMin: true,
        nbPostes: true,
        salaireMini: true,
        salaireMaxi: true,
        dateOuverture: true,
        dateLimite: true,
        statut: true,
        _count: { select: { candidatures: true } },
      },
    });

    if (!poste) {
      return NextResponse.json({ error: "Poste introuvable" }, { status: 404 });
    }

    if (!["OUVERT", "EN_COURS"].includes(poste.statut)) {
      return NextResponse.json({ error: "Ce poste n'accepte plus de candidatures" }, { status: 410 });
    }

    return NextResponse.json({ data: poste });
  } catch (error) {
    console.error("GET /api/public/postes/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
