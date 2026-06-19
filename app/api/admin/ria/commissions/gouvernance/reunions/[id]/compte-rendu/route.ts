import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { genererTachesDepuisCompteRendu } from "@/lib/plansActionAuto";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const cr = await prisma.compteRenduReunionRIA.findUnique({
      where: { reunionId: parseInt(id) },
      include: {
        validePar: { select: { id: true, nom: true, prenom: true } },
      },
    });

    return NextResponse.json({ compteRendu: cr });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// Upsert du compte rendu structuré
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const reunionId = parseInt(id);
    const body = await req.json();
    const { decisions, recommandations, actionsDefinies, observations, valider } = body;

    const data: Record<string, unknown> = {};
    if (decisions       !== undefined) data.decisions       = decisions;
    if (recommandations !== undefined) data.recommandations = recommandations;
    if (actionsDefinies !== undefined) data.actionsDefinies = actionsDefinies;
    if (observations    !== undefined) data.observations    = observations;

    if (valider === true) {
      data.valideParId    = parseInt(session.user.id);
      data.dateValidation = new Date();
    }

    const cr = await prisma.$transaction(async (tx) => {
      const saved = await tx.compteRenduReunionRIA.upsert({
        where: { reunionId },
        create: { reunionId, ...data },
        update: data,
        include: {
          validePar: { select: { id: true, nom: true, prenom: true } },
        },
      });

      // CDC : à la validation du CR, les « actions définies » génèrent automatiquement les tâches.
      if (valider === true) {
        const reunion = await tx.reunionCommissionRIA.findUnique({
          where: { id: reunionId },
          select: { typeCommission: true },
        });
        if (reunion) {
          await genererTachesDepuisCompteRendu(tx, {
            reunionId,
            typeCommission: reunion.typeCommission,
            actionsDefinies: saved.actionsDefinies,
          });
        }
      }

      return saved;
    });

    return NextResponse.json(cr);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
