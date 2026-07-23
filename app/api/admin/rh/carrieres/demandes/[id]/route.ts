import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { StatutDemandeRH, TypeMouvementCarriere } from "@prisma/client";
import { appliquerMouvementCarriere } from "@/lib/carriereMouvement";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/rh/carrieres/demandes/[id]
 * Avance le workflow d'une demande de mouvement de carrière.
 * Cette demande est déjà portée par l'admin/RH (pas de self-service employé) :
 * la transition saute directement EN_ATTENTE → VALIDE_RH → APPROUVE.
 *
 * Body: { action: "VALIDER_RH" | "APPROUVER" | "REJETER" | "ANNULER", commentaire? }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const { action, commentaire } = await req.json();

    if (!action) return NextResponse.json({ error: "action est obligatoire" }, { status: 400 });

    const demande = await prisma.demandeMouvementCarriere.findUnique({ where: { id: Number(id) } });
    if (!demande) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });

    const TRANSITIONS: Record<string, { from: StatutDemandeRH[]; to: StatutDemandeRH }> = {
      VALIDER_RH: { from: ["EN_ATTENTE"],                     to: "VALIDE_RH" },
      APPROUVER:  { from: ["EN_ATTENTE", "VALIDE_RH"],        to: "APPROUVE"  },
      REJETER:    { from: ["EN_ATTENTE", "VALIDE_RH"],        to: "REJETE"    },
      ANNULER:    { from: ["EN_ATTENTE", "VALIDE_RH"],        to: "ANNULE"    },
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
    if (action === "VALIDER_RH" || action === "APPROUVER") {
      updateData.dateValidationRH = new Date();
    }
    if (action === "APPROUVER" || action === "REJETER") {
      updateData.dateDecisionFinale = new Date();
    }
    if (action === "REJETER" && commentaire) {
      updateData.commentaireRefus = commentaire;
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (action === "APPROUVER") {
        const h = await appliquerMouvementCarriere(tx, {
          profilRHId:         demande.profilRHId,
          type:               demande.type as TypeMouvementCarriere,
          nouvelleFonction:   demande.nouvelleFonction,
          nouveauService:     demande.nouveauService,
          nouveauDepartement: demande.nouveauDepartement,
          nouveauSalaire:     demande.nouveauSalaire ? Number(demande.nouveauSalaire) : null,
          nouveauManagerId:   demande.nouveauManagerId,
          motif:              demande.motif,
          modifiePar:         parseInt(session.user.id),
        });
        updateData.historiquePosteId = h.id;
      }

      const d = await tx.demandeMouvementCarriere.update({
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

      await tx.auditLog.create({
        data: {
          userId:   parseInt(session.user.id),
          action:   "UPDATE",
          entite:   "DemandeMouvementCarriere",
          entiteId: d.id,
          details:  { avant: { statut: demande.statut }, apres: { statut: transition.to }, note: commentaire ?? null },
        },
      });

      return d;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/carrieres/demandes/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
