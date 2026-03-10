import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCaissierSession, getCaissierPdvId } from "@/lib/authCaissier";

/**
 * GET — Recherche le profil fidélité d'un client/membre.
 *   ?clientId=1 ou ?userId=2
 * POST — Crédite des points fidélité (lors d'une vente ou d'un remboursement ponctuel).
 */
export async function GET(req: Request) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const callerId = parseInt(session.user.id);
    const isAdmin  = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId    = isAdmin ? null : await getCaissierPdvId(callerId);

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    const userId   = searchParams.get("userId");

    if (!clientId && !userId) {
      return NextResponse.json({ error: "clientId ou userId requis" }, { status: 400 });
    }

    // Vérifier que le client/user appartient bien au PDV du caissier
    if (!isAdmin && pdvId) {
      if (clientId) {
        const client = await prisma.client.findFirst({
          where: { id: parseInt(clientId), pointDeVenteId: pdvId },
        });
        if (!client) {
          return NextResponse.json({ error: "Client non affilié à votre point de vente" }, { status: 403 });
        }
      } else if (userId) {
        const aff = await prisma.gestionnaireAffectation.findFirst({
          where: { userId: parseInt(userId), pointDeVenteId: pdvId, actif: true },
        });
        if (!aff) {
          return NextResponse.json({ error: "Utilisateur non affilié à votre point de vente" }, { status: 403 });
        }
      }
    }

    const profil = await prisma.pointsFidelite.findFirst({
      where: {
        ...(clientId ? { clientId: parseInt(clientId) } : {}),
        ...(userId ? { userId: parseInt(userId) } : {}),
      },
      include: {
        mouvements: { orderBy: { createdAt: "desc" }, take: 10 },
        utilisations: {
          include: { recompense: { select: { nom: true, type: true } } },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    // Récompenses disponibles
    const recompenses = await prisma.recompenseFidelite.findMany({
      where: { actif: true },
      orderBy: { coutPoints: "asc" },
    });

    return NextResponse.json({ profil, recompenses });
  } catch (error) {
    console.error("GET /api/caissier/packs/fidelite", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const callerId = parseInt(session.user.id);
    const isAdmin  = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId    = isAdmin ? null : await getCaissierPdvId(callerId);

    const body = await req.json();
    const { clientId, userId, points, description, referenceId, referenceType, action } = body;

    if (!clientId && !userId) {
      return NextResponse.json({ error: "clientId ou userId requis" }, { status: 400 });
    }
    if (!points || parseInt(points) === 0) {
      return NextResponse.json({ error: "points obligatoire et != 0" }, { status: 400 });
    }

    // Vérifier que le client/user appartient au PDV du caissier
    if (!isAdmin && pdvId) {
      if (clientId) {
        const client = await prisma.client.findFirst({
          where: { id: parseInt(clientId), pointDeVenteId: pdvId },
        });
        if (!client) {
          return NextResponse.json({ error: "Client non affilié à votre point de vente" }, { status: 403 });
        }
      } else if (userId) {
        const aff = await prisma.gestionnaireAffectation.findFirst({
          where: { userId: parseInt(userId), pointDeVenteId: pdvId, actif: true },
        });
        if (!aff) {
          return NextResponse.json({ error: "Utilisateur non affilié à votre point de vente" }, { status: 403 });
        }
      }
    }

    const pointsNum = parseInt(points);

    const result = await prisma.$transaction(async (tx) => {
      // Upsert du profil fidélité
      let profil = await tx.pointsFidelite.findFirst({
        where: {
          ...(clientId ? { clientId: parseInt(clientId) } : {}),
          ...(userId ? { userId: parseInt(userId) } : {}),
        },
      });

      if (!profil) {
        profil = await tx.pointsFidelite.create({
          data: {
            solde: 0,
            totalGagne: 0,
            totalUtilise: 0,
            clientId: clientId ? parseInt(clientId) : null,
            userId: userId ? parseInt(userId) : null,
          },
        });
      }

      // Vérifier solde suffisant pour utilisation
      if (action === "utiliser" && profil.solde < pointsNum) {
        throw new Error(`Solde insuffisant : ${profil.solde} points disponibles`);
      }

      const typesMouvement =
        action === "utiliser" ? "UTILISATION" : "GAIN";

      // Mouvement
      await tx.mouvementPoints.create({
        data: {
          pointsFideliteId: profil.id,
          type: typesMouvement,
          points: action === "utiliser" ? -Math.abs(pointsNum) : Math.abs(pointsNum),
          description,
          referenceId: referenceId ? parseInt(referenceId) : null,
          referenceType,
        },
      });

      // Mise à jour du solde
      const updated = await tx.pointsFidelite.update({
        where: { id: profil.id },
        data: {
          solde:
            action === "utiliser"
              ? { decrement: Math.abs(pointsNum) }
              : { increment: Math.abs(pointsNum) },
          totalGagne:
            action !== "utiliser" ? { increment: Math.abs(pointsNum) } : undefined,
          totalUtilise:
            action === "utiliser" ? { increment: Math.abs(pointsNum) } : undefined,
        },
      });

      return updated;
    });

    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur serveur";
    console.error("POST /api/caissier/packs/fidelite", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
