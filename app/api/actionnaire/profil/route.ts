import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActionnaireSession } from "@/lib/authActionnaire";

/**
 * GET /api/actionnaire/profil
 *
 * Retourne :
 * - Informations personnelles (nom, prénom, email)
 * - Profil actionnaire (statut, type action, nb actions, valeur, % capital)
 * - Total capital social (somme de toutes les actions)
 * - Historique des connexions (sessions)
 */
export async function GET() {
  try {
    const session = await getActionnaireSession();
    if (!session) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const userId = parseInt(session.user.id);

    // Gestionnaire lié à l'utilisateur
    const gestionnaire = await prisma.gestionnaire.findUnique({
      where: { memberId: userId },
      include: {
        member: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
            createdAt: true,
          },
        },
        actionnaireProfile: {
          include: {
            mouvements: {
              orderBy: { date: "desc" },
              take: 5,
            },
          },
        },
      },
    });

    // Total capital social = somme de toutes les actions de tous les actionnaires
    const capitalTotal = await prisma.actionnaireProfile.aggregate({
      _sum: { nombreActions: true },
    });

    const totalActionsEmises = capitalTotal._sum.nombreActions ?? 0;

    const profile = gestionnaire?.actionnaireProfile ?? null;
    const pourcentageCapital =
      totalActionsEmises > 0 && profile
        ? ((profile.nombreActions / totalActionsEmises) * 100).toFixed(2)
        : "0.00";

    const valeurPortefeuille = profile
      ? Number(profile.prixUnitaire) * profile.nombreActions
      : 0;

    return NextResponse.json({
      user: gestionnaire?.member ?? null,
      profile: profile
        ? {
            id: profile.id,
            statut: profile.statut,
            typeAction: profile.typeAction,
            nombreActions: profile.nombreActions,
            prixUnitaire: profile.prixUnitaire,
            valeurPortefeuille,
            pourcentageCapital,
            dateEntree: profile.dateEntree,
            notes: profile.notes,
            derniersMovements: profile.mouvements,
          }
        : null,
      capitalTotal: {
        totalActionsEmises,
      },
    });
  } catch (error) {
    console.error("GET /api/actionnaire/profil", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
