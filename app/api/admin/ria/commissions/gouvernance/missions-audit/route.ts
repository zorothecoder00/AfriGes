import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { CHECKLIST_FINANCEMENT_DEFAULT, checklistInitiale, genRefAudit } from "@/lib/missionAudit";
import { Prisma, StatutMissionAuditRIA } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = req.nextUrl;
    const statut = searchParams.get("statut");

    const missions = await prisma.missionAuditRIA.findMany({
      where: statut ? { statut: statut as StatutMissionAuditRIA } : {},
      include: {
        auditeur:    { select: { id: true, nom: true, prenom: true } },
        financement: { select: { id: true, reference: true, montantFinance: true, client: { select: { nom: true, prenom: true } } } },
        dossierIC:   { select: { id: true, reference: true, titre: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: missions });
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
    const { objet, financementId, dossierICId } = body;
    if (!objet) return NextResponse.json({ error: "objet requis" }, { status: 400 });

    const reference = await genRefAudit();
    const checklist = checklistInitiale(CHECKLIST_FINANCEMENT_DEFAULT);

    const mission = await prisma.missionAuditRIA.create({
      data: {
        reference,
        objet,
        financementId: financementId ? Number(financementId) : null,
        dossierICId:   dossierICId   ? Number(dossierICId)   : null,
        auditeurId:    parseInt(session.user.id),
        checklist: checklist as unknown as Prisma.InputJsonValue,
        statut: "OUVERTE",
      },
    });

    return NextResponse.json(mission, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
