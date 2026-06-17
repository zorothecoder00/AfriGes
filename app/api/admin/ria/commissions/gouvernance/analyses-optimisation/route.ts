import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { genRefOptimisation } from "@/lib/analyseOptimisation";
import { StatutAnalyseOptimisationRIA, TypeConstatOptimisationRIA, TypeRecommandationOptimisationRIA } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = req.nextUrl;
    const statut = searchParams.get("statut");

    const analyses = await prisma.analyseOptimisationRIA.findMany({
      where: statut ? { statut: statut as StatutAnalyseOptimisationRIA } : {},
      include: {
        analyste: { select: { id: true, nom: true, prenom: true } },
        rapport:  { select: { id: true, titre: true, typeCommission: true, periode: true } },
        resolution: { select: { id: true, numero: true, titre: true, statut: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: analyses });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { rapportId, constat, analyse, indicateurActuel, objectifCible, recommandation, recommandationDetail } = body;
    if (!constat || !analyse) return NextResponse.json({ error: "constat et analyse requis" }, { status: 400 });

    const reference = await genRefOptimisation();

    const item = await prisma.analyseOptimisationRIA.create({
      data: {
        reference,
        rapportId: rapportId ? Number(rapportId) : null,
        constat: constat as TypeConstatOptimisationRIA,
        analyse,
        indicateurActuel: indicateurActuel ?? null,
        objectifCible: objectifCible ?? null,
        recommandation: recommandation ? (recommandation as TypeRecommandationOptimisationRIA) : null,
        recommandationDetail: recommandationDetail ?? null,
        analysteId: parseInt(session.user.id),
        statut: "OUVERTE",
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
