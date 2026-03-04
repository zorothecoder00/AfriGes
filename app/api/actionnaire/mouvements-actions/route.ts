import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActionnaireSession } from "@/lib/authActionnaire";

/**
 * GET /api/actionnaire/mouvements-actions
 *
 * Retourne l'historique complet des mouvements d'actions de l'actionnaire :
 * - Achats, cessions, transferts, ajustements
 * - Évolution du portefeuille
 */
export async function GET() {
  try {
    const session = await getActionnaireSession();
    if (!session) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const userId = parseInt(session.user.id);

    const gestionnaire = await prisma.gestionnaire.findUnique({
      where: { memberId: userId },
      include: { actionnaireProfile: true },
    });

    if (!gestionnaire?.actionnaireProfile) {
      return NextResponse.json({ data: [], profil: null });
    }

    const mouvements = await prisma.mouvementAction.findMany({
      where: { profileId: gestionnaire.actionnaireProfile.id },
      orderBy: { date: "desc" },
    });

    // Reconstituer l'évolution du solde dans le temps (du plus ancien au plus récent)
    const sorted = [...mouvements].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let solde = 0;
    const evolution = sorted.map((m) => {
      if (m.type === "ACHAT" || m.type === "TRANSFERT_ENTRANT") {
        solde += m.quantite;
      } else if (m.type === "CESSION" || m.type === "TRANSFERT_SORTANT") {
        solde -= m.quantite;
      } else {
        // AJUSTEMENT peut être positif ou négatif selon le signe de quantite
        solde += m.quantite;
      }
      return {
        date: m.date,
        solde,
        type: m.type,
        quantite: m.quantite,
        prixUnitaire: m.prixUnitaire,
        montantTotal: m.montantTotal,
      };
    });

    return NextResponse.json({
      data: mouvements,
      evolution,
      profil: gestionnaire.actionnaireProfile,
    });
  } catch (error) {
    console.error("GET /api/actionnaire/mouvements-actions", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
