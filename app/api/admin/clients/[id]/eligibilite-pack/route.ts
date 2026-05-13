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
    // Exclure uniquement celles avec une livraison PLANIFIEE déjà en cours (cohérent avec TabLivraisons)
    const souscriptions = await prisma.souscriptionPack.findMany({
      where: {
        clientId,
        statut: { in: ["EN_ATTENTE", "ACTIF", "COMPLETE"] },
        receptions: { none: { statut: "PLANIFIEE" } },
      },
      include: {
        pack: { select: { id: true, nom: true, type: true, frequenceVersement: true } },
        receptions: {
          where:  { statut: "LIVREE" },
          select: { dateLivraison: true, lignes: { select: { quantite: true, prixUnitaire: true } } },
        },
        _count: { select: { versements: true, echeances: true } },
      },
    });

    // Filtrage par type de pack — identique à TabLivraisons dans dashboard/admin/packs
    const souscriptionsEligibles = souscriptions.filter((s) => {
      switch (s.pack.type) {
        case "URGENCE":
          return ["ACTIF", "COMPLETE"].includes(s.statut);
        case "REVENDEUR":
          if (s.formuleRevendeur === "FORMULE_2") return true;
          return ["ACTIF", "COMPLETE"].includes(s.statut);
        default:
          return s.statut === "COMPLETE";
      }
    });

    // Calcul du montant déjà livré par souscription (cycle-aware pour FAMILIAL/EPARGNE_PRODUIT)
    const TYPES_CYCLE = ["FAMILIAL", "EPARGNE_PRODUIT"];
    const eligiblesAvecBudget = souscriptionsEligibles.map((s) => {
      const receptionsRef = TYPES_CYCLE.includes(s.pack.type)
        ? s.receptions.filter(
            (r) => r.dateLivraison != null && new Date(r.dateLivraison) >= new Date(s.dateDebut)
          )
        : s.receptions;
      const montantDejaLivre = receptionsRef.reduce(
        (sum, r) => sum + r.lignes.reduce((s2, l) => s2 + Number(l.prixUnitaire) * l.quantite, 0),
        0
      );
      const { receptions: _r, ...rest } = s;
      return { ...rest, montantDejaLivre };
    });

    const raisons: string[] = [];

    if (souscriptionsEligibles.length === 0) {
      if (souscriptions.length === 0) {
        // Vérifier s'il y a des souscriptions bloquées par une PLANIFIEE en cours
        const avecPlanifiee = await prisma.souscriptionPack.count({
          where: { clientId, statut: { in: ["EN_ATTENTE", "ACTIF", "COMPLETE"] }, receptions: { some: { statut: "PLANIFIEE" } } },
        });
        if (avecPlanifiee > 0) {
          raisons.push("Une livraison est déjà planifiée pour ce client.");
          raisons.push("Attendez la confirmation avant d'en planifier une nouvelle.");
        } else {
          const total = await prisma.souscriptionPack.count({ where: { clientId, statut: { in: ["EN_ATTENTE", "ACTIF", "COMPLETE"] } } });
          if (total === 0) {
            raisons.push("Ce client n'a aucune souscription pack active.");
            raisons.push("Créez d'abord une souscription depuis la page Packs.");
          } else {
            raisons.push("Aucune souscription éligible à une livraison pour ce client.");
            raisons.push("Vérifiez le statut des souscriptions (paiement insuffisant ?).");
          }
        }
      } else {
        const alimentaireActives = souscriptions.filter(
          (s) => s.pack.type === "ALIMENTAIRE" && s.statut === "ACTIF"
        );
        if (alimentaireActives.length > 0) {
          raisons.push("Les packs Alimentaire nécessitent un paiement complet avant la livraison.");
          raisons.push("Continuez les versements jusqu'à solder la souscription.");
        } else {
          raisons.push("Aucune souscription éligible (statut insuffisant ou type non éligible).");
          raisons.push("Vérifiez l'avancement des versements.");
        }
      }
    }

    return NextResponse.json({
      eligible: eligiblesAvecBudget.length > 0,
      souscriptions: eligiblesAvecBudget,
      client,
      raisons,
    });
  } catch (error) {
    console.error("GET /api/admin/clients/[id]/eligibilite-pack", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
