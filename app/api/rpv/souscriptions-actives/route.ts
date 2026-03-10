import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";

/**
 * GET /api/rpv/souscriptions-actives
 * Liste les souscriptions éligibles à une livraison pour les clients du PDV du RPV.
 *
 * Règles d'éligibilité (identiques à /api/admin/clients/[id]/eligibilite-pack) :
 *  - ALIMENTAIRE  → COMPLETE (paiement intégral requis)
 *  - URGENCE      → ACTIF ou COMPLETE (dès l'acompte)
 *  - REVENDEUR F1 → ACTIF ou COMPLETE (après 50% acompte)
 *  - REVENDEUR F2 → toujours éligible (crédit total)
 *  - Autres       → COMPLETE uniquement
 *
 * Exclusions :
 *  - Souscriptions déjà livréees (au moins une réception LIVREE)
 *  - Souscriptions avec une réception PLANIFIEE déjà en cours
 */
export async function GET() {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);
    const pdv = await prisma.pointDeVente.findUnique({ where: { rpvId: userId } });
    if (!pdv) return NextResponse.json({ error: "Aucun PDV associé" }, { status: 400 });

    const souscriptions = await prisma.souscriptionPack.findMany({
      where: {
        statut: { in: ["EN_ATTENTE", "ACTIF", "COMPLETE"] },
        client: { pointDeVenteId: pdv.id },
        // Pas de PLANIFIEE en attente
        receptions: { none: { statut: "PLANIFIEE" } },
      },
      include: {
        pack: {
          select: {
            nom: true,
            type: true,
            produitCible: { select: { id: true, nom: true, prixUnitaire: true } },
          },
        },
        client: { select: { id: true, nom: true, prenom: true, telephone: true } },
        // Inclure les lignes des réceptions LIVREE pour calculer le montant déjà livré
        receptions: {
          where: { statut: "LIVREE" },
          select: {
            id: true,
            lignes: { select: { quantite: true, prixUnitaire: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Types autorisant plusieurs livraisons partielles
    const TYPES_MULTI_LIVRAISON = ["FAMILIAL", "EPARGNE_PRODUIT"];

    // Appliquer les règles d'éligibilité par type
    const eligibles = souscriptions.filter((s) => {
      const hasLivrees = s.receptions.length > 0;

      // Pour les types mono-livraison : déjà livré = plus éligible
      if (hasLivrees && !TYPES_MULTI_LIVRAISON.includes(s.pack.type)) return false;

      // EN_ATTENTE uniquement autorisé pour REVENDEUR F2
      if (s.statut === "EN_ATTENTE" && !(s.pack.type === "REVENDEUR" && s.formuleRevendeur === "FORMULE_2")) return false;

      // Pour les types multi-livraison déjà entamés : vérifier qu'il reste de la capacité
      if (hasLivrees && TYPES_MULTI_LIVRAISON.includes(s.pack.type)) {
        const montantDejaLivre = s.receptions.reduce(
          (sum, r) => sum + r.lignes.reduce((s2, l) => s2 + Number(l.prixUnitaire) * l.quantite, 0),
          0
        );
        if (montantDejaLivre >= Number(s.montantTotal)) return false; // pack entièrement livré
        return ["ACTIF", "COMPLETE"].includes(s.statut);
      }

      switch (s.pack.type) {
        case "ALIMENTAIRE":
          return s.statut === "COMPLETE";
        case "URGENCE":
          return ["ACTIF", "COMPLETE"].includes(s.statut);
        case "REVENDEUR":
          if (s.formuleRevendeur === "FORMULE_2") return true;
          return ["ACTIF", "COMPLETE"].includes(s.statut);
        case "FAMILIAL":
        case "EPARGNE_PRODUIT":
          return ["ACTIF", "COMPLETE"].includes(s.statut);
        default:
          return s.statut === "COMPLETE";
      }
    });

    return NextResponse.json({
      success: true,
      data: eligibles.map((s) => {
        const montantDejaLivre = s.receptions.reduce(
          (sum, r) => sum + r.lignes.reduce((s2, l) => s2 + Number(l.prixUnitaire) * l.quantite, 0),
          0
        );
        return {
          id:               s.id,
          statut:           s.statut,
          montantTotal:     Number(s.montantTotal),
          montantVerse:     Number(s.montantVerse),
          montantRestant:   Number(s.montantRestant),
          montantDejaLivre,
          pack: {
            nom:          s.pack.nom,
            type:         s.pack.type,
            produitCible: s.pack.produitCible
              ? { id: s.pack.produitCible.id, nom: s.pack.produitCible.nom, prixUnitaire: Number(s.pack.produitCible.prixUnitaire) }
              : null,
          },
          client: s.client
            ? { id: s.client.id, nom: s.client.nom, prenom: s.client.prenom, telephone: s.client.telephone }
            : null,
        };
      }),
    });
  } catch (error) {
    console.error("GET /api/rpv/souscriptions-actives", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
