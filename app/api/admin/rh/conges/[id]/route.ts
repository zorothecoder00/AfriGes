import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutDemandeConge, TypeConge } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/rh/conges/[id]
 * Avance le workflow d'une demande de congé
 *
 * Body: { action: "VALIDER_MANAGER" | "VALIDER_RH" | "APPROUVER" | "REJETER", commentaire? }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const { action, commentaire } = await req.json();

    if (!action) return NextResponse.json({ error: "action est obligatoire" }, { status: 400 });

    const demande = await prisma.demandeConge.findUnique({
      where: { id: Number(id) },
      include: { profilRH: { select: { id: true } } },
    });
    if (!demande) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });

    // Transitions autorisées
    const TRANSITIONS: Record<string, { from: StatutDemandeConge[]; to: StatutDemandeConge }> = {
      VALIDER_MANAGER: { from: ["EN_ATTENTE"],       to: "VALIDE_MANAGER" },
      VALIDER_RH:      { from: ["VALIDE_MANAGER"],   to: "VALIDE_RH"      },
      APPROUVER:       { from: ["EN_ATTENTE", "VALIDE_MANAGER", "VALIDE_RH"], to: "APPROUVE" },
      REJETER:         { from: ["EN_ATTENTE", "VALIDE_MANAGER", "VALIDE_RH"], to: "REJETE"  },
    };

    const transition = TRANSITIONS[action];
    if (!transition) return NextResponse.json({ error: "Action invalide" }, { status: 400 });
    if (!transition.from.includes(demande.statut)) {
      return NextResponse.json(
        { error: `Impossible de passer de ${demande.statut} avec l'action ${action}` },
        { status: 422 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = { statut: transition.to };

    if (action === "VALIDER_MANAGER") {
      updateData.managerId          = parseInt(session.user.id);
      updateData.dateValidationMgr  = new Date();
    }
    if (action === "VALIDER_RH" || action === "APPROUVER") {
      updateData.rhId               = parseInt(session.user.id);
      updateData.dateValidationRH   = new Date();
    }
    if (action === "APPROUVER" || action === "REJETER") {
      updateData.dateDecisionFinale = new Date();
    }
    if (action === "REJETER" && commentaire) {
      updateData.commentaireRefus = commentaire;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const d = await tx.demandeConge.update({
        where: { id: Number(id) },
        data: updateData,
        include: {
          profilRH: {
            select: {
              id: true, matricule: true,
              gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
            },
          },
        },
      });

      // Quand approuvé → déduire du solde de congé
      if (action === "APPROUVER") {
        const annee = new Date(demande.dateDebut).getFullYear();
        const politique = await tx.politiqueConge.findUnique({
          where: { type: demande.type as TypeConge },
        });
        const totalDroit = politique?.joursParAn ?? 0;

        await tx.soldeConge.upsert({
          where: { profilRHId_type_annee: { profilRHId: demande.profilRHId, type: demande.type, annee } },
          create: {
            profilRHId: demande.profilRHId,
            type:       demande.type,
            annee,
            totalDroit,
            pris:       demande.nbJours,
            restant:    Math.max(0, totalDroit - demande.nbJours),
          },
          update: {
            pris:    { increment: demande.nbJours },
            restant: { decrement: demande.nbJours },
          },
        });
      }

      return d;
    });

    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "UPDATE",
        entite:   "DemandeConge",
        entiteId: updated.id,
        details:  `Demande #${id} : ${demande.statut} → ${transition.to}`,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/conges/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
