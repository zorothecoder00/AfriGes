import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutDemandeRH } from "@prisma/client";
import { notifyDecisionDemandeFormation } from "@/lib/notificationsRH";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/rh/formations/demandes/[id]
 * Avance le workflow d'une demande de formation, calqué sur les congés.
 * Body: { action: "VALIDER_MANAGER" | "VALIDER_RH" | "APPROUVER" | "REJETER" | "ANNULER", commentaire? }
 *
 * À APPROUVER, si la demande est liée à une session (formationId), inscrit
 * automatiquement le collaborateur (ParticipationFormation, statut INSCRIT).
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const { action, commentaire } = await req.json();

    if (!action) return NextResponse.json({ error: "action est obligatoire" }, { status: 400 });

    const demande = await prisma.demandeFormation.findUnique({ where: { id: Number(id) } });
    if (!demande) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });

    const TRANSITIONS: Record<string, { from: StatutDemandeRH[]; to: StatutDemandeRH }> = {
      VALIDER_MANAGER: { from: ["EN_ATTENTE"],                              to: "VALIDE_MANAGER" },
      VALIDER_RH:      { from: ["VALIDE_MANAGER"],                          to: "VALIDE_RH"      },
      APPROUVER:       { from: ["EN_ATTENTE", "VALIDE_MANAGER", "VALIDE_RH"], to: "APPROUVE"      },
      REJETER:         { from: ["EN_ATTENTE", "VALIDE_MANAGER", "VALIDE_RH"], to: "REJETE"        },
      ANNULER:         { from: ["EN_ATTENTE", "VALIDE_MANAGER", "VALIDE_RH"], to: "ANNULE"         },
    };

    const transition = TRANSITIONS[action];
    if (!transition) return NextResponse.json({ error: "Action invalide" }, { status: 400 });
    if (!transition.from.includes(demande.statut)) {
      return NextResponse.json(
        { error: `Impossible de passer de ${demande.statut} avec l'action ${action}` },
        { status: 422 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = { statut: transition.to };
    if (action === "VALIDER_MANAGER") updateData.dateValidationMgr = new Date();
    if (action === "VALIDER_RH" || action === "APPROUVER") updateData.dateValidationRH = new Date();
    if (action === "APPROUVER" || action === "REJETER") updateData.dateDecisionFinale = new Date();
    if (action === "REJETER" && commentaire) updateData.commentaireRefus = commentaire;

    const updated = await prisma.$transaction(async (tx) => {
      const d = await tx.demandeFormation.update({ where: { id: Number(id) }, data: updateData });

      if (action === "APPROUVER" && demande.formationId) {
        await tx.participationFormation.upsert({
          where:  { formationId_profilRHId: { formationId: demande.formationId, profilRHId: demande.profilRHId } },
          create: { formationId: demande.formationId, profilRHId: demande.profilRHId, statut: "INSCRIT" },
          update: {},
        });
      }

      await tx.auditLog.create({
        data: {
          userId:   parseInt(session.user.id),
          action:   "UPDATE",
          entite:   "DemandeFormation",
          entiteId: d.id,
          details:  { avant: { statut: demande.statut }, apres: { statut: transition.to }, note: commentaire ?? null },
        },
      });

      return d;
    });

    if (action === "VALIDER_MANAGER" || action === "APPROUVER" || action === "REJETER") {
      notifyDecisionDemandeFormation({
        profilRHId: demande.profilRHId,
        intitule:   demande.intituleSouhaite,
        decision:   action === "VALIDER_MANAGER" ? "VALIDE_MANAGER" : action === "APPROUVER" ? "APPROUVE" : "REJETE",
        motif:      action === "REJETER" ? (commentaire ?? undefined) : undefined,
      }).catch(() => {});
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/formations/demandes/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
