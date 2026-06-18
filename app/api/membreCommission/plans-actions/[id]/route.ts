import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommissionMembreSession, getRoleMembre, ROLES_SUIVI_ACTIONS } from "@/lib/authCommissionRIA";
import { StatutPlanActionCommRIA, PrioriteActionRIA } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

// Mise à jour d'une tâche :
//  - le responsable assigné peut faire évoluer statut / progression / notes
//  - le Président et le Rapporteur 2 (suivi des actions) peuvent en plus éditer
//    le contenu (titre, priorité, responsable, échéance)
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const planId = parseInt(id);
    const userId = parseInt(auth.session.user.id);
    const body = await req.json();
    const { statut, titre, description, priorite, responsableId, dateDebut, dateEcheance, progression, notes } = body;

    const existant = await prisma.planActionCommRIA.findUnique({
      where: { id: planId },
      select: { typeCommission: true, responsableId: true },
    });
    if (!existant) return NextResponse.json({ error: "Tâche introuvable" }, { status: 404 });

    const skip = auth.commission === null; // admin/RESPONSABLE_RIA
    const role = skip ? null : await getRoleMembre(userId, existant.typeCommission);
    if (!skip && !role) {
      return NextResponse.json({ error: "Vous n'êtes pas membre de cette commission" }, { status: 403 });
    }

    const estSuivi = skip || (role !== null && ROLES_SUIVI_ACTIONS.includes(role));
    const estResponsable = existant.responsableId === userId;
    if (!estSuivi && !estResponsable) {
      return NextResponse.json(
        { error: "Seuls le responsable de la tâche, le Président ou le Rapporteur 2 peuvent la modifier" },
        { status: 403 }
      );
    }

    const data: Record<string, unknown> = {};

    // Suivi (statut / progression / notes) — ouvert au responsable et aux rôles de suivi
    if (statut !== undefined) {
      data.statut = statut as StatutPlanActionCommRIA;
      if (statut === "REALISE" || statut === "TERMINE") {
        data.dateTermine = new Date();
        if (progression === undefined) data.progression = 100;
      }
    }
    if (progression !== undefined) data.progression = Math.min(100, Math.max(0, Number(progression)));
    if (notes !== undefined) data.notes = notes;

    // Édition du contenu — réservée aux rôles de suivi (attribution des tâches)
    const editeContenu = titre !== undefined || description !== undefined || priorite !== undefined
      || responsableId !== undefined || dateDebut !== undefined || dateEcheance !== undefined;
    if (editeContenu) {
      if (!estSuivi) {
        return NextResponse.json({ error: "Édition réservée au Président et au Rapporteur 2" }, { status: 403 });
      }
      if (titre !== undefined) data.titre = titre;
      if (description !== undefined) data.description = description;
      if (priorite !== undefined) data.priorite = priorite as PrioriteActionRIA;
      if (responsableId !== undefined) data.responsableId = responsableId ? Number(responsableId) : null;
      if (dateDebut !== undefined) data.dateDebut = dateDebut ? new Date(dateDebut) : null;
      if (dateEcheance !== undefined) data.dateEcheance = dateEcheance ? new Date(dateEcheance) : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Aucune modification" }, { status: 400 });
    }

    const plan = await prisma.planActionCommRIA.update({
      where: { id: planId },
      data,
      include: {
        responsable: { select: { id: true, nom: true, prenom: true } },
        resolution: { select: { id: true, numero: true, titre: true } },
        reunion: { select: { id: true, titre: true } },
      },
    });

    return NextResponse.json(plan);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
