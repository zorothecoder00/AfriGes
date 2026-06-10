import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";
import { StatutDemandeConge } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/responsableRH/conges/[id]
 * Actions autorisées pour le RESPONSABLE_RH :
 *   VALIDER_MANAGER — EN_ATTENTE → VALIDE_MANAGER
 *   REJETER         — EN_ATTENTE | VALIDE_MANAGER → REJETE
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const { action, commentaire } = await req.json();

    if (!action) return NextResponse.json({ error: "action est obligatoire" }, { status: 400 });

    const demande = await prisma.demandeConge.findUnique({ where: { id: Number(id) } });
    if (!demande) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });

    const TRANSITIONS: Record<string, { from: StatutDemandeConge[]; to: StatutDemandeConge }> = {
      VALIDER_MANAGER: { from: ["EN_ATTENTE"],                  to: "VALIDE_MANAGER" },
      REJETER:         { from: ["EN_ATTENTE", "VALIDE_MANAGER"], to: "REJETE"         },
    };

    const transition = TRANSITIONS[action];
    if (!transition) {
      return NextResponse.json({ error: "Action non autorisée pour le Responsable RH" }, { status: 403 });
    }
    if (!transition.from.includes(demande.statut)) {
      return NextResponse.json(
        { error: `Impossible de passer de ${demande.statut} avec l'action ${action}` },
        { status: 422 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = { statut: transition.to };
    if (action === "VALIDER_MANAGER") {
      updateData.managerId         = parseInt(session.user.id);
      updateData.dateValidationMgr = new Date();
    }
    if (action === "REJETER") {
      updateData.dateDecisionFinale = new Date();
      if (commentaire) updateData.commentaireRefus = commentaire;
    }

    const updated = await prisma.demandeConge.update({
      where:   { id: Number(id) },
      data:    updateData,
      include: {
        profilRH: {
          select: {
            id: true, matricule: true,
            gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "UPDATE",
        entite:   "DemandeConge",
        entiteId: updated.id,
        details:  { avant: { statut: demande.statut }, apres: { statut: transition.to }, note: commentaire ?? null },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/responsableRH/conges/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
