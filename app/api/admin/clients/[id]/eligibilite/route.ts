import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/clients/[id]/eligibilite
 * Vérifie si un client est éligible pour consommer son crédit alimentaire.
 * Un client est éligible s'il possède au moins un crédit alimentaire ACTIF
 * avec un montant restant > 0 (généré via cotisation payée ou tontine).
 *
 * Retourne :
 *   - eligible         : boolean
 *   - credits          : liste des crédits actifs du client
 *   - hasCotisationPayee : si le client a au moins une cotisation payée
 *   - hasActiveTontine  : si le client est membre d'une tontine active
 *   - raisons          : explication en cas de non-éligibilité
 */
export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const session = await getAuthSession();
    if (
      !session ||
      !session.user.role ||
      !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)
    ) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const { id } = await params;
    const clientId = Number(id);
    if (isNaN(clientId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, nom: true, prenom: true, telephone: true },
    });

    if (!client) {
      return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    }

    // Crédits alimentaires actifs avec solde disponible
    const credits = await prisma.creditAlimentaire.findMany({
      where: {
        clientId,
        statut: "ACTIF",
        montantRestant: { gt: 0 },
      },
      select: {
        id: true,
        plafond: true,
        montantRestant: true,
        montantUtilise: true,
        statut: true,
        source: true,
        dateExpiration: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const eligible = credits.length > 0;

    let hasCotisationPayee = false;
    let hasActiveTontine = false;
    const raisons: string[] = [];

    if (!eligible) {
      // Vérifier les raisons de non-éligibilité pour informer l'admin
      const [cotisationPayee, tontineMembre] = await Promise.all([
        prisma.cotisation.findFirst({
          where: { clientId, statut: "PAYEE" },
        }),
        prisma.tontineMembre.findFirst({
          where: {
            clientId,
            dateSortie: null,
            tontine: { statut: "ACTIVE" },
          },
        }),
      ]);

      hasCotisationPayee = !!cotisationPayee;
      hasActiveTontine = !!tontineMembre;

      if (!hasCotisationPayee && !hasActiveTontine) {
        raisons.push(
          "Ce client n'a aucune cotisation payée et ne participe à aucune tontine active."
        );
        raisons.push(
          "Un crédit alimentaire (généré via cotisation ou tontine) est requis pour effectuer un achat."
        );
      } else {
        // Le client a des activités mais son crédit est épuisé ou expiré
        const creditsInactifs = await prisma.creditAlimentaire.findMany({
          where: { clientId },
          select: { statut: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        });

        const dernierStatut = creditsInactifs[0]?.statut;

        if (dernierStatut === "EPUISE") {
          raisons.push("Le crédit alimentaire de ce client a été entièrement consommé (épuisé).");
        } else if (dernierStatut === "EXPIRE") {
          raisons.push("Le crédit alimentaire de ce client a expiré.");
        } else {
          raisons.push("Ce client n'a pas de crédit alimentaire actif disponible.");
        }

        if (hasCotisationPayee) {
          raisons.push("Il a des cotisations payées — un nouveau crédit peut être généré si une nouvelle cotisation est payée.");
        }
        if (hasActiveTontine) {
          raisons.push("Il participe à une tontine active — un crédit sera généré lorsqu'il recevra le pot.");
        }
      }
    }

    return NextResponse.json({
      eligible,
      credits,
      client,
      hasCotisationPayee,
      hasActiveTontine,
      raisons,
    });
  } catch (error) {
    console.error("GET /admin/clients/[id]/eligibilite error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la vérification de l'éligibilité" },
      { status: 500 }
    );
  }
}
