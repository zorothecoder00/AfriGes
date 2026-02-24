import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET — Vérifie l'éligibilité d'un client à une vente via ses souscriptions Pack actives.
 * Remplace l'ancienne logique cotisation/tontine → CreditAlimentaire.
 *
 * Règles par type :
 * - ALIMENTAIRE : seulement si statut COMPLETE (paiement intégral requis avant livraison)
 * - URGENCE     : ACTIF ou COMPLETE (livraison immédiate dès l'acompte versé)
 * - REVENDEUR F1: ACTIF ou COMPLETE (livraison immédiate après 50% acompte)
 * - REVENDEUR F2: EN_ATTENTE, ACTIF ou COMPLETE (crédit total → livraison avant tout remboursement)
 * - Autres      : seulement COMPLETE
 *
 * Retourne :
 * - eligible: boolean
 * - souscriptions: souscriptions éligibles du client
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

    // Chercher les souscriptions pertinentes (EN_ATTENTE inclus pour REVENDEUR F2 crédit total)
    // On filtre les receptions à celles LIVREE uniquement pour ne pas bloquer les PLANIFIEE
    const souscriptions = await prisma.souscriptionPack.findMany({
      where: {
        clientId,
        statut: { in: ["EN_ATTENTE", "ACTIF", "COMPLETE"] },
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

    // Filtrage par type de pack (cohérent avec la route livraison)
    // - ALIMENTAIRE → livraison uniquement après paiement complet (COMPLETE)
    // - URGENCE → livraison immédiate dès l'acompte (ACTIF ou COMPLETE)
    // - REVENDEUR F1 → livraison immédiate après 50% acompte (ACTIF ou COMPLETE)
    // - REVENDEUR F2 → crédit total, livraison immédiate (EN_ATTENTE, ACTIF ou COMPLETE)
    // - Autres → COMPLETE uniquement
    const souscriptionsEligibles = souscriptions.filter((s) => {
      // Déjà livré → pas éligible
      if (s.receptions.length > 0) return false;
      // EN_ATTENTE uniquement autorisé pour REVENDEUR F2
      if (s.statut === "EN_ATTENTE" && !(s.pack.type === "REVENDEUR" && s.formuleRevendeur === "FORMULE_2")) return false;

      switch (s.pack.type) {
        case "ALIMENTAIRE":
          return s.statut === "COMPLETE";
        case "URGENCE":
          return ["ACTIF", "COMPLETE"].includes(s.statut);
        case "REVENDEUR":
          // F2 = crédit total → livraison avant tout remboursement
          if (s.formuleRevendeur === "FORMULE_2") return true;
          // F1 = livraison après 50% acompte
          return ["ACTIF", "COMPLETE"].includes(s.statut);
        default:
          return s.statut === "COMPLETE";
      }
    });

    const raisons: string[] = [];

    if (souscriptionsEligibles.length === 0) {
      if (souscriptions.length === 0) {
        raisons.push("Ce client n'a aucune souscription pack active.");
        raisons.push("Créez d'abord une souscription depuis la page Packs.");
      } else {
        const alimentaireActives = souscriptions.filter(
          (s) => s.pack.type === "ALIMENTAIRE" && s.statut === "ACTIF"
        );
        if (alimentaireActives.length > 0) {
          raisons.push("Les packs Alimentaire nécessitent un paiement complet avant la livraison.");
          raisons.push("Continuez les versements jusqu'à solder la souscription.");
        } else {
          raisons.push("Toutes les souscriptions de ce client ont déjà reçu leurs produits.");
          raisons.push("Créez une nouvelle souscription pour une nouvelle livraison.");
        }
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
