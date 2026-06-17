import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { Prisma, TypeConstatOptimisationRIA, TypeRecommandationOptimisationRIA } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const item = await prisma.analyseOptimisationRIA.findUnique({
      where: { id: parseInt(id) },
      include: {
        analyste: { select: { id: true, nom: true, prenom: true } },
        rapport:  { select: { id: true, titre: true, typeCommission: true, periode: true } },
        resolution: { select: { id: true, numero: true, titre: true, statut: true } },
      },
    });
    if (!item) return NextResponse.json({ error: "Analyse introuvable" }, { status: 404 });

    return NextResponse.json(item);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const {
      constat, analyse, indicateurActuel, objectifCible,
      recommandation, recommandationDetail, statut,
    } = body;

    const data: Prisma.AnalyseOptimisationRIAUpdateInput = {};
    if (constat !== undefined) data.constat = constat as TypeConstatOptimisationRIA;
    if (analyse !== undefined) data.analyse = analyse;
    if (indicateurActuel !== undefined) data.indicateurActuel = indicateurActuel;
    if (objectifCible !== undefined) data.objectifCible = objectifCible;
    if (recommandation !== undefined) data.recommandation = recommandation as TypeRecommandationOptimisationRIA;
    if (recommandationDetail !== undefined) data.recommandationDetail = recommandationDetail;
    if (statut !== undefined) data.statut = statut;

    const item = await prisma.analyseOptimisationRIA.update({
      where: { id: parseInt(id) },
      data,
      include: {
        analyste: { select: { id: true, nom: true, prenom: true } },
        resolution: { select: { id: true, numero: true, titre: true, statut: true } },
      },
    });

    return NextResponse.json(item);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
