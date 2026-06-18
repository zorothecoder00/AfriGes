import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCommissionMembreSession, getRoleMembre, isPresident,
  ROLES_REDACTION_CR, peutOutrepasserGating,
} from "@/lib/authCommissionRIA";

type Ctx = { params: Promise<{ id: string }> };

async function chargerContexte(reunionId: number) {
  return prisma.reunionCommissionRIA.findUnique({
    where: { id: reunionId },
    select: { typeCommission: true },
  });
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const reunionId = parseInt(id);
    const userId = parseInt(auth.session.user.id);

    const reunion = await chargerContexte(reunionId);
    if (!reunion) return NextResponse.json({ error: "Réunion introuvable" }, { status: 404 });

    if (auth.commission !== null && !(await getRoleMembre(userId, reunion.typeCommission))) {
      return NextResponse.json({ error: "Vous n'êtes pas membre de cette commission" }, { status: 403 });
    }

    const cr = await prisma.compteRenduReunionRIA.findUnique({
      where: { reunionId },
      include: { validePar: { select: { id: true, nom: true, prenom: true } } },
    });
    return NextResponse.json({ compteRendu: cr });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// Rédaction (Président / Rapporteurs) ; validation (`valider`) = Président uniquement (CDC)
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const reunionId = parseInt(id);
    const userId = parseInt(auth.session.user.id);
    const body = await req.json();
    const { decisions, recommandations, actionsDefinies, observations, valider } = body;

    const reunion = await chargerContexte(reunionId);
    if (!reunion) return NextResponse.json({ error: "Réunion introuvable" }, { status: 404 });

    const skip = peutOutrepasserGating(auth.session.user.role) || auth.commission === null;
    const role = skip ? null : await getRoleMembre(userId, reunion.typeCommission);

    if (!skip && (!role || !ROLES_REDACTION_CR.includes(role))) {
      return NextResponse.json({ error: "Rédaction du compte rendu réservée au Président et aux Rapporteurs" }, { status: 403 });
    }

    // Un compte rendu validé est verrouillé
    const existant = await prisma.compteRenduReunionRIA.findUnique({
      where: { reunionId }, select: { dateValidation: true },
    });
    if (existant?.dateValidation) {
      return NextResponse.json({ error: "Compte rendu déjà validé — non modifiable" }, { status: 409 });
    }

    const data: Record<string, unknown> = {};
    if (decisions       !== undefined) data.decisions       = decisions;
    if (recommandations !== undefined) data.recommandations = recommandations;
    if (actionsDefinies !== undefined) data.actionsDefinies = actionsDefinies;
    if (observations    !== undefined) data.observations    = observations;

    if (valider === true) {
      const president = skip || (await isPresident(userId, reunion.typeCommission));
      if (!president) {
        return NextResponse.json({ error: "Seul le Président peut valider le compte rendu" }, { status: 403 });
      }
      data.valideParId = userId;
      data.dateValidation = new Date();
    }

    const cr = await prisma.compteRenduReunionRIA.upsert({
      where: { reunionId },
      create: { reunionId, ...data },
      update: data,
      include: { validePar: { select: { id: true, nom: true, prenom: true } } },
    });

    return NextResponse.json(cr);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
