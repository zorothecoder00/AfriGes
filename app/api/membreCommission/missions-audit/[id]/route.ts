import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommissionMembreSession } from "@/lib/authCommissionRIA";
import { Prisma, ResultatMissionAuditRIA, NiveauRisqueMissionAuditRIA } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

async function estMembreAudit(userId: number) {
  const membre = await prisma.membreCommissionRIA.findFirst({
    where: { userId, typeCommission: "AUDIT", actif: true },
  });
  return !!membre;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(auth.session.user.id);
    if (auth.commission !== null && !(await estMembreAudit(userId))) {
      return NextResponse.json({ error: "Réservé aux membres de la commission Audit & Contrôle" }, { status: 403 });
    }

    const { id } = await params;
    const mission = await prisma.missionAuditRIA.findUnique({
      where: { id: parseInt(id) },
      include: {
        auditeur: { select: { id: true, nom: true, prenom: true } },
        financement: {
          select: {
            id: true, reference: true, montantFinance: true, montantRembourse: true, encours: true,
            client: { select: { id: true, nom: true, prenom: true, telephone: true } },
            mouvements:     { select: { id: true, type: true, montant: true, sens: true, createdAt: true } },
            remboursements: { select: { id: true, montant: true, createdAt: true } },
          },
        },
        dossierIC: { select: { id: true, reference: true, titre: true, statut: true } },
      },
    });
    if (!mission) return NextResponse.json({ error: "Mission introuvable" }, { status: 404 });

    return NextResponse.json(mission);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(auth.session.user.id);
    if (auth.commission !== null && !(await estMembreAudit(userId))) {
      return NextResponse.json({ error: "Réservé aux membres de la commission Audit & Contrôle" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { checklist, statut, resultat, niveauRisque, conclusion } = body;

    const data: Prisma.MissionAuditRIAUpdateInput = {};
    if (checklist !== undefined) data.checklist = checklist as Prisma.InputJsonValue;
    if (statut !== undefined) data.statut = statut;
    if (conclusion !== undefined) data.conclusion = conclusion;
    if (resultat !== undefined) data.resultat = resultat as ResultatMissionAuditRIA;
    if (niveauRisque !== undefined) data.niveauRisque = niveauRisque as NiveauRisqueMissionAuditRIA;

    if (statut === "CLOTUREE") {
      if (!resultat) return NextResponse.json({ error: "Un résultat (conforme/non conforme) est requis pour clôturer" }, { status: 400 });
      data.dateCloture = new Date();
    }

    const mission = await prisma.missionAuditRIA.update({
      where: { id: parseInt(id) },
      data,
      include: { auditeur: { select: { id: true, nom: true, prenom: true } } },
    });

    return NextResponse.json(mission);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
