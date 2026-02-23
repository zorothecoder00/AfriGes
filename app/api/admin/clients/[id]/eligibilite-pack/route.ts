import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET — Vérifie l'éligibilité d'un client à une vente via ses souscriptions Pack actives.
 * Remplace l'ancienne logique cotisation/tontine → CreditAlimentaire.
 *
 * Retourne :
 * - eligible: boolean
 * - souscriptions: souscriptions actives du client
 * - raisons: liste de raisons si non éligible
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const clientId = parseInt(id);

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, nom: true, prenom: true, telephone: true },
    });

    if (!client) {
      return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    }

    // Chercher les souscriptions actives ou complètes (livraison non encore reçue)
    const souscriptions = await prisma.souscriptionPack.findMany({
      where: {
        clientId,
        statut: { in: ["ACTIF", "COMPLETE"] },
      },
      include: {
        pack: {
          select: { id: true, nom: true, type: true, frequenceVersement: true },
        },
        receptions: {
          where: { statut: "LIVREE" },
          select: { id: true },
        },
        _count: { select: { versements: true, echeances: true } },
      },
    });

    // Filtrer : souscriptions sans livraison validée
    const souscriptionsEligibles = souscriptions.filter(
      (s) => s.receptions.length === 0 || s.statut === "ACTIF"
    );

    const raisons: string[] = [];

    if (souscriptionsEligibles.length === 0) {
      if (souscriptions.length === 0) {
        raisons.push("Ce client n'a aucune souscription pack active.");
        raisons.push("Créez d'abord une souscription depuis la page Packs.");
      } else {
        raisons.push("Toutes les souscriptions de ce client ont déjà reçu leurs produits.");
        raisons.push("Créez une nouvelle souscription pour une nouvelle livraison.");
      }
    }

    return NextResponse.json({
      eligible: souscriptionsEligibles.length > 0,
      souscriptions: souscriptionsEligibles,
      client,
      raisons,
    });
  } catch (error) {
    console.error("GET /api/admin/clients/[id]/eligibilite-pack", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
